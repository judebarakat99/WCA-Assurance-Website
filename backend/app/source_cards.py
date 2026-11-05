"""Deterministic presentation and numerical grounding for browser-supplied demo records."""

import math
import re
from datetime import date

from .schemas import Source, SourceCheck, SourceFact


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def display_date(value):
    try:
        return date.fromisoformat(str(value)).strftime("%d %b %Y").lstrip("0")
    except (ValueError, TypeError):
        return "Not supplied"


def fact(label, value):
    return SourceFact(label=label, value=str(value) if value is not None else "Not supplied")


def numeric_fact(label, value, metric, unit, ratio=False):
    if not number(value):
        return fact(label, None)
    amount = round(value * 100 if ratio else value, 1)
    return SourceFact(
        label=label,
        value=f"{amount:g}{'%' if unit == 'percent' else ' days'}",
        metric=metric,
        numeric_value=amount,
        unit=unit,
    )


def day_distance(left, right):
    try:
        return (date.fromisoformat(str(left)) - date.fromisoformat(str(right))).days
    except (ValueError, TypeError):
        return None


def programme_source(identifier, section, record, as_of, names):
    venue_id = record.get("venue") or record.get("id")
    venue_name = names.get(venue_id, str(venue_id or "Programme"))
    title = str(record.get("text") or record.get("title") or record.get("name") or venue_name)[:240]
    source = Source(id=identifier, kind="programme", title=title, category=section, as_of=as_of)
    if section == "forecasts":
        source.title = venue_name
        gate = record.get("gate") or {}
        source.facts = [
            fact("Next gate", gate.get("name")),
            fact("Milestone", display_date(record.get("gateDate"))),
            fact("Scenario P50", display_date(record.get("p50"))),
            fact("Scenario P80", display_date(record.get("p80"))),
            numeric_fact(
                "On-time probability",
                record.get("on_time_probability"),
                "on_time_pct",
                "percent",
                True,
            ),
        ]
        delay = record.get("days_beyond_milestone")
        if number(delay):
            source.facts.append(
                numeric_fact(
                    "Beyond milestone" if delay > 0 else "Before milestone",
                    abs(delay),
                    "milestone_distance_days",
                    "days",
                )
            )
        source.facts.append(
            fact("PMC scheduled finish", display_date((record.get("pmc") or {}).get("finish")))
        )
    elif section == "venues":
        readiness = record.get("readiness") or {}
        gate = record.get("gate") or {}
        source.facts = [
            fact("City", record.get("city")),
            numeric_fact(
                "Overall venue assured readiness",
                readiness.get("assured"),
                "overall_assured_pct",
                "percent",
                True,
            ),
            numeric_fact(
                "Overall venue declared readiness",
                readiness.get("declared"),
                "overall_declared_pct",
                "percent",
                True,
            ),
            fact("Gate", gate.get("name") or "All gates passed"),
            numeric_fact(
                "Gate-scope assured readiness",
                gate.get("assured_readiness"),
                "gate_assured_pct",
                "percent",
                True,
            ),
            numeric_fact(
                "Gate-scope required readiness",
                gate.get("required_assured_readiness"),
                "gate_required_pct",
                "percent",
                True,
            ),
        ]
        source.checks = [
            SourceCheck(
                label=str(rule.get("text", "Gate condition")),
                met=bool(rule.get("met")),
                blockers=[str(item) for item in rule.get("blockers", [])],
            )
            for rule in gate.get("rules", [])
        ]
    elif section == "obligations":
        criterion = record.get("criterion") or {}
        operator = {"min": "≥", "max": "≤", "eq": "=", "bool": "Yes / no"}.get(
            criterion.get("operator"), ""
        )
        source.facts = [
            fact("Record", record.get("id")),
            fact("Venue", venue_name),
            fact("Status", record.get("state")),
            fact("Owner", record.get("owner")),
            fact("Criticality", record.get("criticality")),
            fact(
                "Criterion",
                f"{operator} {criterion.get('value') if criterion.get('value') is not None else ''} {criterion.get('unit') or ''}".strip(),
            ),
            fact("Requirement", criterion.get("clause")),
        ]
    elif section == "issues":
        source.facts = [
            fact("Record", record.get("id")),
            fact("Obligation", record.get("obligation")),
            fact("Status", record.get("status")),
            fact("Criticality", record.get("criticality")),
            fact("Due", display_date(record.get("due"))),
        ]
    elif section == "decisions":
        source.facts = [
            fact("Record", record.get("id")),
            fact("Venue", venue_name),
            fact("Status", record.get("status")),
            fact("Decision owner", record.get("owner")),
            fact("Decide by", display_date(record.get("lrm"))),
        ]
    if section == "forecasts":
        source.facts.append(
            numeric_fact("P80 confidence level", 80, "p80_confidence_pct", "percent")
        )
        source.facts.append(
            numeric_fact("P50 confidence level", 50, "p50_confidence_pct", "percent")
        )
        margin = day_distance(record.get("gateDate"), (record.get("pmc") or {}).get("finish"))
        if margin is not None:
            source.facts.append(
                numeric_fact(
                    "PMC schedule margin" if margin >= 0 else "PMC scheduled delay",
                    abs(margin),
                    "pmc_margin_days",
                    "days",
                )
            )
    elif section in {"decisions", "issues"}:
        delta = day_distance(
            record.get("lrm") if section == "decisions" else record.get("due"), as_of
        )
        if delta is not None:
            source.facts.append(
                numeric_fact(
                    "Days remaining" if delta >= 0 else "Days overdue",
                    abs(delta),
                    "deadline_distance_days",
                    "days",
                )
            )
    return source


def validate_claims(answer, sources):
    """Reject unsupported quantitative claims; this is not a verifier of all prose."""
    verified = []
    for claim in answer.claims:
        source = sources.get(claim.source_id)
        item = next((f for f in source.facts if f.metric == claim.metric), None) if source else None
        if (
            claim.source_id not in answer.source_ids
            or not item
            or item.numeric_value is None
            or not number(claim.value)
            or not math.isclose(claim.value, item.numeric_value, abs_tol=0.051)
        ):
            raise RuntimeError(
                f"Claim {claim.source_id}/{claim.metric} must be cited and must match a metric_catalog entry exactly; correct the metric, source or value."
            )
        verified.append((claim.value, item.unit))
    # Model claims are scope-checked above. Prose may legitimately use a whole
    # percentage (52%) for a source rounded to one decimal place (51.8%).
    for identifier in answer.source_ids:
        source = sources.get(identifier)
        if source:
            verified.extend(
                (item.numeric_value, item.unit)
                for item in source.facts
                if item.numeric_value is not None
            )
    # Check explicit percentages and durations. Other numbers (e.g. dates, lux)
    # remain grounded through source references rather than this narrow check.
    for match in re.finditer(
        r"(?<![\w.])([0-9]+(?:\.[0-9]+)?)\s*(%|percent\b|days?\b)", answer.reply, re.I
    ):
        value = float(match.group(1))
        unit = "percent" if match.group(2).lower() in {"%", "percent"} else "days"
        if any(
            u == unit
            and (
                math.isclose(value, v, abs_tol=0.051) or (value.is_integer() and value == round(v))
            )
            for v, u in verified
        ):
            continue
        # Percentages/durations explicitly present in a cited document passage
        # can also be quoted; they do not become programme compliance metrics.
        found = False
        for identifier in answer.source_ids:
            source = sources.get(identifier)
            if source and source.kind == "document" and source.excerpt:
                found = any(
                    float(m.group(1)) == value
                    and ("percent" if m.group(2).lower() in {"%", "percent"} else "days") == unit
                    for m in re.finditer(
                        r"(?<![\w.])([0-9]+(?:\.[0-9]+)?)\s*(%|percent\b|days?\b)",
                        source.excerpt,
                        re.I,
                    )
                )
                if found:
                    break
        if not found:
            raise RuntimeError(
                f"The reply contains {value:g} {unit} without a matching verified claim. Add the correct catalog claim or remove this unsupported number."
            )


def validate_explanation(answer):
    # Narrow guards for specific unsupported interpretations seen in live checks.
    patterns = [
        r"(?:readiness|gate conditions|(?:PMC|schedule) float).{0,100}(?:driv(?:e|es|ing)|caus(?:e|es|ing|ed))",
        r"(?:float|PMC schedule).{0,100}(?:insufficient|not sufficient|sufficient to assure)",
        r"incomplete (?:telecom|infrastructure)",
    ]
    if any(re.search(pattern, answer.reply, re.I | re.S) for pattern in patterns):
        raise RuntimeError(
            "Report separate observations: missing verification does not prove incomplete infrastructure, and schedule float does not establish forecast causes or assure completion. State that exact causal drivers are unavailable."
        )


def source_facts_reply(sources):
    lines = ["I could not verify the drafted explanation. Here are the supplied demo facts:"]
    for source in sources[:3]:
        lines.append("\n" + source.title)
        lines.extend(
            f"• {item.label}: {item.value}" for item in source.facts if item.value != "Not supplied"
        )
        lines.extend(
            f"• {'Met' if check.met else 'Unmet'}: {check.label}" for check in source.checks
        )
        if source.kind == "document" and source.excerpt:
            lines.append(source.excerpt[:1500])
    lines.append(
        "\nForecasts use illustrative assumptions. The supplied records do not establish exact causal drivers."
    )
    return "\n".join(lines)


def risk_explanation(question, snapshot, sources):
    """Compose the explicit venue-risk workflow from records, not inferred causes."""
    if not re.search(r"\bwhy\b.*\b(?:risk|late|behind)\b", question, re.I):
        return None
    matches = []
    for index, venue in enumerate(snapshot.venues):
        for alias in [venue.get("name"), venue.get("city"), venue.get("id")]:
            if alias and re.search(r"\b" + re.escape(str(alias)) + r"\b", question, re.I):
                matches.append((index, venue))
                break
    if not matches:
        return None
    index, venue = matches[0]
    forecast_index = next(
        (i for i, f in enumerate(snapshot.forecasts) if f.get("id") == venue.get("id")), None
    )
    if forecast_index is None:
        return None
    venue_source = sources[f"V{index + 1}"]
    forecast_source = sources[f"F{forecast_index + 1}"]
    values = {item.label: item.value for item in venue_source.facts}
    forecast_values = {item.label: item.value for item in forecast_source.facts}
    forecast = snapshot.forecasts[forecast_index]
    delay = forecast.get("days_beyond_milestone")
    distance_label = "Beyond milestone" if number(delay) and delay > 0 else "Before milestone"
    lines = [
        f"In the current demo, {venue_source.title} has these forecast and assurance signals:",
        "\nForecast signal",
        f"• On-time probability: {forecast_values.get('On-time probability', 'Not supplied')}.",
        f"• Scenario P80: {forecast_values.get('Scenario P80', 'Not supplied')}; milestone: {forecast_values.get('Milestone', 'Not supplied')}.",
        f"• {distance_label}: {forecast_values.get(distance_label, 'Not supplied')}.",
        f"• PMC scheduled finish: {forecast_values.get('PMC scheduled finish', 'Not supplied')}. This is a separate schedule estimate.",
        "\nReadiness scope",
        f"• Overall venue assured readiness: {values.get('Overall venue assured readiness', 'Not supplied')}.",
        f"• {values.get('Gate', 'Current gate')} gate-scope assured readiness: {values.get('Gate-scope assured readiness', 'Not supplied')}; required: {values.get('Gate-scope required readiness', 'Not supplied')}.",
        "\nUnmet gate conditions",
    ]
    unmet = [check for check in venue_source.checks if not check.met]
    if not unmet:
        lines.append("• No unmet gate conditions are recorded in this snapshot.")
    for check in unmet:
        lines.append(
            "• Unmet condition: "
            + check.label
            + (". Blocking obligations: " + ", ".join(check.blockers) if check.blockers else "")
        )
    lines.append(
        "\nThese are observed signals, not a proven causal explanation of the delay. Forecast durations are illustrative. Missing verification does not prove that physical infrastructure is incomplete."
    )
    return "\n".join(lines), [forecast_source, venue_source]
