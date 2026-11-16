"""Deterministic progress arithmetic. The model extracts figures; this module
does every calculation, so recalculated progress never depends on the model."""

from datetime import date

# Within this many percentage points a reported figure counts as supported.
TOLERANCE = 5.0


def planned_fraction(start: date, finish: date, as_of: date) -> float:
    """Planned completion at as_of, assuming work builds up evenly from the
    start of the start day to the end of the finish day."""
    if as_of < start:
        return 0.0
    if as_of >= finish:
        return 1.0
    total = (finish - start).days + 1
    return ((as_of - start).days + 1) / total


def package_progress(activities: list[dict], as_of: date) -> dict:
    """Weighted planned and actual progress (0-100) for one scope element.
    activities: {weight, start, finish (date), actual (0-100)}."""
    weight = sum(a["weight"] for a in activities)
    if weight <= 0:
        raise ValueError("Activity weights must add up to more than zero")
    planned = sum(a["weight"] * planned_fraction(a["start"], a["finish"], as_of) for a in activities)
    actual = sum(a["weight"] * a["actual"] / 100 for a in activities)
    return {
        "planned": round(100 * planned / weight, 1),
        "actual": round(100 * actual / weight, 1),
        "weight_total": round(weight, 2),
        "activities_done": sum(1 for a in activities if a["actual"] >= 100),
        "activities": len(activities),
    }


def overall(packages: list[dict]) -> dict:
    """Budget-weighted roll-up of packages: {budget, planned, actual}."""
    budget = sum(p["budget"] for p in packages)
    if budget <= 0:
        raise ValueError("Package budgets must add up to more than zero")
    return {
        "planned": round(sum(p["budget"] * p["planned"] for p in packages) / budget, 1),
        "actual": round(sum(p["budget"] * p["actual"] for p in packages) / budget, 1),
        "budget": round(budget, 2),
    }


def status(claimed: float | None, actual: float, planned: float, missing: bool) -> str:
    """overstated, evidence-missing, behind-plan or supported."""
    if claimed is not None and claimed - actual > TOLERANCE:
        return "overstated"
    if missing:
        return "evidence-missing"
    if planned - actual > TOLERANCE:
        return "behind-plan"
    return "supported"
