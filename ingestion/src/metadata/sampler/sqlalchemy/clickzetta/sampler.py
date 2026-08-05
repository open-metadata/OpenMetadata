"""Bounded ClickZetta sampling for profiler and data-quality workflows.

ClickZetta can execute ordinary SQLAlchemy ``LIMIT`` queries, but the
connector does not yet have a validated native percentage/random sampling
primitive.  This adapter therefore makes bounded row sampling explicit and
fails closed for every other sampling mode.  The service spec remains gated
until a bounded live smoke test is approved.
"""

import re
from collections.abc import Iterable

from sqlalchemy import Select, select
from sqlalchemy.schema import Table

from metadata.generated.schema.type.staticSamplingConfig import StaticSamplingConfig
from metadata.sampler.sqlalchemy.sampler import SQASampler
from metadata.utils.helpers import is_safe_sql_query

MAX_CLICKZETTA_SAMPLE_ROWS = 1_000
_LIMIT_PATTERN = re.compile(r"\blimit\s+(\d+)\b", re.IGNORECASE)


def _normalise_sample_type(profile_sample_type) -> str:
    value = getattr(profile_sample_type, "value", profile_sample_type)
    return str(value).upper()


def validate_bounded_select(query: str, *, max_rows: int = MAX_CLICKZETTA_SAMPLE_ROWS) -> int:
    """Validate a custom query before it can be sent to ClickZetta.

    The common SQL safety helper rejects writes, but it intentionally allows a
    plain ``SELECT`` without a limit.  A plain select is unsafe for this
    connector because sample-data and profiling jobs could scan an entire
    production table, so a positive, bounded ``LIMIT`` is mandatory here.
    """

    if not query or not is_safe_sql_query(query):
        raise ValueError("ClickZetta sample SQL must be a read-only SELECT")

    match = _LIMIT_PATTERN.search(query)
    if match is None:
        raise ValueError("ClickZetta sample SQL must include a positive LIMIT")

    limit = int(match.group(1))
    if limit <= 0 or limit > max_rows:
        raise ValueError(f"ClickZetta sample LIMIT must be between 1 and {max_rows}")
    return limit


def _validate_limit(limit: int, *, max_rows: int = MAX_CLICKZETTA_SAMPLE_ROWS) -> int:
    if isinstance(limit, bool) or not isinstance(limit, int):
        raise TypeError("ClickZetta sample limit must be an integer")
    if limit <= 0:
        raise ValueError("ClickZetta sample LIMIT must be a positive integer")
    if limit > max_rows:
        raise ValueError(f"ClickZetta sample LIMIT must be between 1 and {max_rows}")
    return limit


def build_bounded_sample_query(table: Table, column_names: Iterable[str] | None, limit: int) -> Select:
    """Build a bounded SQLAlchemy select without touching a live connection."""

    limit = _validate_limit(limit)
    available_columns = {column.name: column for column in table.columns}
    if column_names:
        selected_columns = []
        for name in column_names:
            try:
                selected_columns.append(available_columns[name])
            except KeyError as exc:
                raise ValueError(f"Unknown ClickZetta sample column: {name}") from exc
    else:
        selected_columns = list(table.columns)

    if not selected_columns:
        raise ValueError("ClickZetta sample requires at least one column")
    return select(*selected_columns).select_from(table).limit(limit)


class ClickzettaSampler(SQASampler):
    """SQLAlchemy sampler that never silently falls back to a full scan."""

    MAX_SAMPLE_ROWS = MAX_CLICKZETTA_SAMPLE_ROWS

    @classmethod
    def validate_profile_sample(cls, profile_sample, profile_sample_type) -> int:
        """Validate the OpenMetadata static sampling configuration."""

        if _normalise_sample_type(profile_sample_type) != "ROWS":
            raise ValueError("ClickZetta sampling currently supports ROWS only; percentage sampling is disabled")
        if isinstance(profile_sample, bool):
            raise TypeError("ClickZetta sample limit must be a positive integer")
        try:
            limit = int(profile_sample)
        except (TypeError, ValueError) as exc:
            raise ValueError("ClickZetta sample limit must be a positive integer") from exc
        if str(profile_sample) != str(limit):
            raise ValueError("ClickZetta sample limit must be an integer")
        return _validate_limit(limit, max_rows=cls.MAX_SAMPLE_ROWS)

    def get_sample_query(self, static: StaticSamplingConfig | None, *, column=None):
        """Return a bounded CTE and avoid the generic random/count path."""

        if static is None:
            raise ValueError("ClickZetta profiling requires an explicit bounded ROWS sample")
        limit = self.validate_profile_sample(static.profileSample, static.profileSampleType)
        if getattr(self.sample_config, "randomizedSample", False) is True:
            raise ValueError("ClickZetta randomized sampling is disabled until dialect SQL is validated")

        selectable = self.set_tablesample(None, self.raw_dataset.__table__)  # type: ignore[attr-defined]
        query = self._base_sample_query(selectable, column)
        return query.limit(limit).cte(f"{self.get_sampler_table_name()}_sample")

    def get_dataset(self, column=None, **kwargs):
        """Always return a bounded dataset unless a bounded custom query is used."""

        if self.sample_query:
            return self._rdn_sample_from_user_query()

        static = self._resolve_sample_config
        if static is None:
            raise ValueError("ClickZetta profiling requires an explicit bounded ROWS sample")
        return self.get_sample_query(static, column=column)

    def _rdn_sample_from_user_query(self):
        validate_bounded_select(self.sample_query, max_rows=self.MAX_SAMPLE_ROWS)
        return super()._rdn_sample_from_user_query()

    def _fetch_sample_data_from_user_query(self):
        validate_bounded_select(self.sample_query, max_rows=self.MAX_SAMPLE_ROWS)
        return super()._fetch_sample_data_from_user_query()

    def fetch_sample_data(self, columns=None):
        if self.sample_query:
            return super().fetch_sample_data(columns)
        _validate_limit(self.sample_limit, max_rows=self.MAX_SAMPLE_ROWS)
        return super().fetch_sample_data(columns)
