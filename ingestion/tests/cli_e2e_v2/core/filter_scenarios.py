#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
"""Portable filter scenarios for per-connector `test_filter` parametrization.

Every SQL connector that ships a `customers` / `transactions` baseline
pair (all of them — see `core/source/common_baseline.py`) can run the
same matrix of filter semantics: include-exact, exclude-exact, schema-
only, and regex include+exclude with exclude priority.

Shape:
  - `FilterScenario.filter_kwargs` is PORTABLE — only mentions table /
    schema names that exist in the common baseline.
  - Expected-tables per variant is NOT portable (baselines add
    connector-specific tables like MySQL's `all_types`, Postgres's
    future `geom_table`, etc.). Each connector's test module maps
    scenario.variant → its own expected-tables list.

This keeps the filter-semantics matrix declared once: when we add a
fifth scenario (e.g. "include + exclude same pattern"), it's one edit
here that all connectors pick up.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class FilterScenario:
    """One row in the filter-parametrize matrix.

    variant:       short token used as the service-name suffix (keeps
                   per-variant OM services isolated for STRICT-mode
                   extras detection).
    id:            human-readable pytest id for the test report.
    filter_kwargs: kwargs to pass straight into `WorkflowConfig.with_filter`.
    """

    variant: str
    id: str
    filter_kwargs: dict[str, list[str]] = field(default_factory=dict)


def expected_tables_for(
    scenario: FilterScenario,
    mapping: dict[str, list[str] | None],
    *,
    connector: str,
) -> list[str] | None:
    """Safe lookup for per-connector `_EXPECTED_TABLES_BY_VARIANT` dicts.

    When a new `FilterScenario` is added to `COMMON_FILTER_SCENARIOS`, every
    connector must supply a corresponding entry in its per-connector
    mapping. A missing entry manifests as `KeyError` at test collection
    time, which hides the actionable message — this helper turns it into
    an AssertionError naming the connector, the missing variant, and the
    fix location so a junior can resolve it in one read.
    """
    try:
        return mapping[scenario.variant]
    except KeyError as exc:
        raise AssertionError(
            f"[{connector}] no expected_tables entry for filter scenario "
            f"{scenario.variant!r} (pytest id: {scenario.id}). Add it to "
            f"the connector's _EXPECTED_TABLES_BY_VARIANT mapping."
        ) from exc


# Ordered by increasing complexity so a failing earlier scenario typically
# points at a more-fundamental issue than a failing later one.
COMMON_FILTER_SCENARIOS: tuple[FilterScenario, ...] = (
    FilterScenario(
        variant="inc_exact",
        id="tables_include_exact",
        filter_kwargs={
            "schemas_include": ["e2e"],
            "tables_include": ["customers"],
        },
    ),
    FilterScenario(
        variant="exc_exact",
        id="tables_exclude_exact",
        # `transactions` is guaranteed present in every SQL baseline via
        # common_baseline; connectors that add dialect-specific tables
        # (e.g. MySQL's `all_types`) should include those in the expected
        # list for this variant on their side.
        filter_kwargs={
            "schemas_include": ["e2e"],
            "tables_exclude": ["transactions"],
        },
    ),
    FilterScenario(
        variant="sch_inc",
        id="schemas_include_only_e2e",
        filter_kwargs={"schemas_include": ["e2e"]},
    ),
    FilterScenario(
        variant="regex_prio",
        id="regex_exclude_has_priority_over_include",
        # include=customer.* matches both `customers` and any view
        # starting with `customer_` (e.g. MySQL's `customer_txn_summary`);
        # exclude=customer_txn.* trims the latter. With exclude priority,
        # only `customers` should survive.
        filter_kwargs={
            "schemas_include": ["e2e"],
            "tables_include": ["customer.*"],
            "tables_exclude": ["customer_txn.*"],
        },
    ),
)
