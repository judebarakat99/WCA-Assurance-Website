import pytest

from app.chat import build_context, clean_reply
from app.programme_queries import programme_answer
from app.schemas import ProgrammeContext


def snapshot():
    return ProgrammeContext(
        as_of="2026-11-05",
        venues=[
            {"id": "JED", "city": "Jeddah", "name": "Jeddah Stadium"},
            {"id": "RUH", "city": "Riyadh", "name": "Riyadh Stadium"},
        ],
        forecasts=[
            {"id": "RUH", "on_time_probability": 0.5, "days_beyond_milestone": 10},
            {
                "id": "JED",
                "on_time_probability": 0.097,
                "days_beyond_milestone": 56,
                "gate": {"name": "Construction complete"},
                "p80": "2027-05-26",
                "gateDate": "2027-03-31",
            },
        ],
        obligations=[
            {
                "id": "JED-1",
                "venue": "JED",
                "text": "Fibre routes",
                "criticality": "Critical",
                "state": "Assigned",
            },
            {
                "id": "JED-2",
                "venue": "JED",
                "text": "Grass surface",
                "criticality": "High",
                "state": "Assigned",
            },
            {
                "id": "JED-3",
                "venue": "JED",
                "text": "Verified capacity",
                "criticality": "Critical",
                "state": "Verified",
            },
            {
                "id": "RUH-1",
                "venue": "RUH",
                "text": "Pitch length",
                "criticality": "Critical",
                "state": "Submitted",
            },
        ],
    )


def ask(question, context=None):
    context = context or snapshot()
    _, sources = build_context(context)
    return programme_answer(question, context, sources)


def test_highest_risk_ranks_all_forecasts_and_uses_matching_sources():
    reply, sources = ask("Which venue is highest risk?")
    assert "Jeddah Stadium" in reply and "9.7%" in reply
    assert "56 days beyond" in reply and "26 May 2027" in reply
    assert [s.id for s in sources] == ["F2", "V1"]
    assert ask("Which venue is highest risk?") == (reply, sources)
    context = snapshot()
    context.forecasts[0]["on_time_probability"] = 0.01
    assert "Riyadh Stadium" in ask("Which venue is highest risk?", context)[0]


def test_tie_breaking_and_exact_ties_are_explicit():
    context = snapshot()
    context.forecasts[0]["on_time_probability"] = 0.097
    assert "Jeddah Stadium" in ask("Which venue is highest risk?", context)[0]
    context.forecasts[0]["days_beyond_milestone"] = 56
    reply, sources = ask("Which venue is highest risk?", context)
    assert "tie" in reply and "Jeddah Stadium" in reply and "Riyadh Stadium" in reply
    assert {s.id for s in sources} == {"F1", "F2", "V1", "V2"}


@pytest.mark.parametrize("invalid", [None, True, -1, 2, "0.01", float("nan")])
def test_invalid_probabilities_do_not_win(invalid):
    context = snapshot()
    context.forecasts[0]["on_time_probability"] = invalid
    assert "Jeddah Stadium" in ask("Which venue is highest risk?", context)[0]


def test_missing_forecasts_do_not_invent_a_winner():
    context = snapshot()
    context.forecasts = []
    assert "cannot rank" in ask("Which venue is highest risk?", context)[0]


def test_critical_filter_uses_classification_and_status_not_gate_blockers():
    context = snapshot()
    context.venues[0]["gate"] = {"rules": [{"met": False, "blockers": ["JED-2"]}]}
    reply, sources = ask("Which critical obligations are unverified?", context)
    assert "2 unverified Critical" in reply
    assert "JED-1" in reply and "RUH-1" in reply
    assert "JED-2" not in reply and "JED-3" not in reply
    assert [s.id for s in sources] == ["O1", "O4"]


def test_venue_scope_and_empty_results():
    reply, sources = ask("Which critical obligations are unverified in Jeddah?")
    assert "1 unverified Critical" in reply and "RUH-1" not in reply
    assert [s.id for s in sources] == ["O1"]
    context = snapshot()
    context.obligations[0]["state"] = "Verified"
    assert (
        "0 unverified Critical"
        in ask("Which critical obligations are unverified for JED?", context)[0]
    )
    assert "Which venue" in ask("Which critical obligations are unverified in Unknown City?")[0]


def test_comparisons_and_document_questions_still_use_model():
    assert (
        ask("Which critical obligations are unverified according to the uploaded document?") is None
    )
    assert ask("Which venue is highest risk if we change the deadline?") is None
    assert ask("Why is the highest risk venue worse than Riyadh?") is None


def test_generic_reply_removes_internal_references_but_keeps_document_titles():
    assert (
        clean_reply("Jeddah (source_id: V2) is at risk.\nSources: F2, V2, metric_catalog")
        == "Jeddah is at risk."
    )
    assert clean_reply("Evidence reviewed.\nSource IDs: D1, P") == "Evidence reviewed."
    assert clean_reply("Sources: FIFA Stadium Guidelines") == "Sources: FIFA Stadium Guidelines"
