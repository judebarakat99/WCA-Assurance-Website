"""Exact read-only answers for common programme questions, using the current snapshot."""

import re

from .source_cards import number, risk_explanation


def milestone_ranking(snapshot):
    rows = []
    for index, record in enumerate(snapshot.forecasts):
        probability = record.get("on_time_probability")
        delay = record.get("days_beyond_milestone")
        if number(probability) and 0 <= probability <= 1 and number(delay):
            rows.append(
                {
                    "id": record.get("id"),
                    "source_id": f"F{index + 1}",
                    "on_time_probability": probability,
                    "days_beyond_milestone": delay,
                }
            )
    return sorted(
        rows,
        key=lambda row: (row["on_time_probability"], -row["days_beyond_milestone"], str(row["id"])),
    )


def highest_risk(snapshot, sources):
    venue_ids = {venue.get("id") for venue in snapshot.venues}
    ranking = [row for row in milestone_ranking(snapshot) if row["id"] in venue_ids]
    if not ranking:
        return (
            "The current demo snapshot has no usable venue forecasts, so I cannot "
            "rank milestone delay risk.",
            [sources["P"]],
        )
    winner = ranking[0]
    tied = [
        row
        for row in ranking
        if (row["on_time_probability"], row["days_beyond_milestone"])
        == (winner["on_time_probability"], winner["days_beyond_milestone"])
    ]
    references = []
    lines = [
        "In the current demo, "
        + (
            "these venues tie for highest milestone delay risk:"
            if len(tied) > 1
            else "the highest-risk venue by milestone delay risk is:"
        )
    ]
    for row in tied:
        venue_index, venue = next(
            (i, v) for i, v in enumerate(snapshot.venues) if v.get("id") == row["id"]
        )
        forecast_source = sources[row["source_id"]]
        values = {item.label: item.value for item in forecast_source.facts}
        delay = row["days_beyond_milestone"]
        distance_label = "Beyond milestone" if delay > 0 else "Before milestone"
        distance = (
            "on the milestone"
            if delay == 0
            else f"{values.get(distance_label, 'Not supplied')} "
            + ("beyond the milestone" if delay > 0 else "before the milestone")
        )
        lines.extend(
            [
                f"• {venue.get('name') or row['id']} ({row['id']})",
                f"  Next gate: {values.get('Next gate', 'Not supplied')}.",
                f"  On-time probability: {values.get('On-time probability', 'Not supplied')}.",
                f"  Scenario P80: {values.get('Scenario P80', 'Not supplied')}; "
                f"milestone: {values.get('Milestone', 'Not supplied')} — {distance}.",
            ]
        )
        references.extend([forecast_source, sources[f"V{venue_index + 1}"]])
    lines.append(
        "\nRanking uses the lowest on-time probability, breaking ties by the greatest "
        "P80 delay. Readiness scores are a separate measure. Forecasts are illustrative."
    )
    return "\n".join(lines), references


def unverified_critical(question, snapshot, sources):
    # Exact aliases allow a named venue scope without guessing from chat history.
    venues = [
        v
        for v in snapshot.venues
        if any(
            alias and re.search(r"\b" + re.escape(str(alias)) + r"\b", question, re.I)
            for alias in (v.get("id"), v.get("name"), v.get("city"))
        )
    ]
    if not venues and re.search(r"\b(?:in|for|at)\b", question, re.I):
        return ("Which venue do you mean? Use its name, city, or venue ID from the demo.", [])
    scope = {v.get("id") for v in venues}
    names = {v.get("id"): str(v.get("name") or v.get("id")) for v in snapshot.venues}
    rows = [
        (i, o)
        for i, o in enumerate(snapshot.obligations)
        if str(o.get("criticality", "")).strip().casefold() == "critical"
        and str(o.get("state", "")).strip().casefold() != "verified"
        and (not scope or o.get("venue") in scope)
    ]
    rows.sort(key=lambda row: (str(row[1].get("venue", "")), str(row[1].get("id", ""))))
    scope_label = (
        (" for " + ", ".join(names[v.get("id")] for v in venues)) if venues else " across venues"
    )
    lines = [f"The current demo has {len(rows)} unverified Critical obligations{scope_label}."]
    references = []
    current_venue = object()
    for index, obligation in rows:
        venue_id = obligation.get("venue")
        if venue_id != current_venue:
            lines.append("\n" + names.get(venue_id, str(venue_id or "Venue not supplied")))
            current_venue = venue_id
        lines.append(
            f"• {obligation.get('id') or 'ID not supplied'} — "
            f"{obligation.get('text') or 'Description not supplied'} "
            f"[Status: {obligation.get('state') or 'Not supplied'}]"
        )
        references.append(sources[f"O{index + 1}"])
    lines.append(
        "\nFilter: Critical classification and status other than Verified. "
        "High obligations and already Verified obligations are excluded. "
        "Missing verification does not establish that physical work is incomplete."
    )
    # The snapshot supports the count, including the zero-result case.
    return "\n".join(lines), references or [sources["P"]]


def programme_answer(question, snapshot, sources):
    query = question.strip().rstrip("?!.").strip()
    if re.fullmatch(
        r"(?:which|what) (?:venue|stadium) (?:is|has) (?:the )?"
        r"(?:highest risk|highest[- ]risk|most risk|greatest risk|most at risk)"
        r"(?: (?:currently|right now|today))?|"
        r"(?:which|what) is (?:the )?(?:highest[- ]risk|riskiest) (?:venue|stadium)",
        query,
        re.I,
    ):
        return highest_risk(snapshot, sources)
    if re.fullmatch(
        r"(?:which|what|list|show(?: me)?) (?:the |all )?critical obligations "
        r"(?:(?:are |remain |are still )?(?:unverified|not verified)|"
        r"(?:have not|haven't) been verified)(?: (?:in|for|at) .+)?",
        query,
        re.I,
    ):
        return unverified_critical(query, snapshot, sources)
    if re.search(r"\b(?:compare|versus|than|if)\b", query, re.I):
        return None
    return risk_explanation(question, snapshot, sources)
