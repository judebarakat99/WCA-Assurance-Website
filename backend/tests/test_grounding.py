import pytest

from app.chat import build_context
from app.schemas import ModelAnswer, ProgrammeContext
from app.source_cards import validate_claims


def sample_context():
    return ProgrammeContext(
        as_of="2026-11-05",
        summary={"assured": 0.54},
        venues=[
            {
                "id": "JED",
                "name": "King Abdullah Sports City Stadium",
                "city": "Jeddah",
                "readiness": {"assured": 0.3586206897, "declared": 0.5862068966},
                "gate": {
                    "id": "G3",
                    "name": "Construction complete",
                    "assured_readiness": 0.52,
                    "required_assured_readiness": 0.9,
                    "rules": [
                        {
                            "met": False,
                            "text": "Critical obligations need verification",
                            "blockers": ["JED-ITT-01"],
                        }
                    ],
                },
            }
        ],
        forecasts=[
            {
                "id": "JED",
                "gate": {"name": "Construction complete"},
                "gateDate": "2027-03-31",
                "p80": "2027-05-26",
                "p50": "2027-05-04",
                "on_time_probability": 0.097,
                "days_beyond_milestone": 56,
                "pmc": {"finish": "2027-03-20"},
            }
        ],
    )


def test_source_cards_distinguish_gate_and_overall_readiness_and_have_no_json():
    sections, sources = build_context(sample_context())
    venue = sources["V1"]
    values = {fact.metric: fact.value for fact in venue.facts if fact.metric}
    assert values["overall_assured_pct"] == "35.9%"
    assert values["gate_assured_pct"] == "52%"
    assert venue.checks[0].blockers == ["JED-ITT-01"]
    assert venue.excerpt is None
    assert sources["F1"].title == "King Abdullah Sports City Stadium"
    assert next(f.value for f in sources["F1"].facts if f.label == "Scenario P80") == "26 May 2027"
    assert next(f.value for f in sources["F1"].facts if f.metric == "on_time_pct") == "9.7%"
    assert sections["metric_catalog"]


def test_numerical_claims_must_match_the_correct_scope():
    _, sources = build_context(sample_context())
    answer = ModelAnswer(
        reply="Overall venue readiness is 35.9%; G3 gate-scope readiness is 52%.",
        source_ids=["V1"],
        claims=[
            {"source_id": "V1", "metric": "overall_assured_pct", "value": 35.9},
            {"source_id": "V1", "metric": "gate_assured_pct", "value": 52},
        ],
    )
    validate_claims(answer, sources)
    answer.claims[0].value = 52
    with pytest.raises(RuntimeError, match="must be cited"):
        validate_claims(answer, sources)


def test_unsupported_numbers_and_uncited_claims_are_rejected():
    _, sources = build_context(sample_context())
    with pytest.raises(RuntimeError, match="without a matching"):
        validate_claims(ModelAnswer(reply="The probability is 99%.", source_ids=["F1"]), sources)
    with pytest.raises(RuntimeError, match="must be cited"):
        validate_claims(
            ModelAnswer(
                reply="9.7%",
                source_ids=[],
                claims=[{"source_id": "F1", "metric": "on_time_pct", "value": 9.7}],
            ),
            sources,
        )


def test_forecast_probability_and_days_use_source_values():
    _, sources = build_context(sample_context())
    validate_claims(
        ModelAnswer(
            reply="On-time probability is 9.7%, with P80 56 days beyond the milestone.",
            source_ids=["F1"],
            claims=[
                {"source_id": "F1", "metric": "on_time_pct", "value": 9.7},
                {"source_id": "F1", "metric": "milestone_distance_days", "value": 56},
            ],
        ),
        sources,
    )


def test_confidence_levels_and_pmc_margin_are_explicit_metrics():
    _, sources = build_context(sample_context())
    metrics = {f.metric: f.numeric_value for f in sources["F1"].facts if f.metric}
    assert metrics["pmc_margin_days"] == 11
    assert metrics["p80_confidence_pct"] == 80


def test_legitimate_whole_percentage_rounding_and_cited_pmc_margin():
    _, sources = build_context(sample_context())
    validate_claims(
        ModelAnswer(
            reply="Overall assured readiness is 36%. The PMC schedule margin is 11 days.",
            source_ids=["V1", "F1"],
            claims=[{"source_id": "V1", "metric": "overall_assured_pct", "value": 35.9}],
        ),
        sources,
    )


def test_unsupported_causal_explanations_are_rejected():
    from app.source_cards import validate_explanation

    with pytest.raises(RuntimeError, match="separate observations"):
        validate_explanation(
            ModelAnswer(reply="Low readiness is driving the forecast delay.", source_ids=[])
        )


@pytest.mark.parametrize(
    "reply",
    [
        "There is incomplete telecom infrastructure.",
        "The PMC schedule has 11 days of float, but that is not sufficient to assure completion.",
    ],
)
def test_missing_verification_cannot_be_promoted_to_physical_failure(reply):
    from app.source_cards import validate_explanation

    with pytest.raises(RuntimeError):
        validate_explanation(ModelAnswer(reply=reply, source_ids=[]))


def test_jeddah_risk_explanation_is_composed_from_current_scoped_records():
    from app.source_cards import risk_explanation

    snapshot = sample_context()
    _, sources = build_context(snapshot)
    reply, references = risk_explanation("Why is Jeddah at risk?", snapshot, sources)
    assert "9.7%" in reply and "56 days" in reply
    assert "35.9%" in reply and "52%" in reply
    assert "JED-ITT-01" in reply
    assert "not a proven causal explanation" in reply
    assert len(references) == 2
    assert risk_explanation("What is programme readiness?", snapshot, sources) is None


def test_risk_brief_does_not_label_an_on_track_forecast_as_late():
    from app.source_cards import risk_explanation

    snapshot = sample_context()
    snapshot.forecasts[0]["days_beyond_milestone"] = -12
    _, sources = build_context(snapshot)
    reply, _ = risk_explanation("Why is Jeddah at risk?", snapshot, sources)
    assert "Before milestone: 12 days" in reply
    assert "Beyond milestone:" not in reply
