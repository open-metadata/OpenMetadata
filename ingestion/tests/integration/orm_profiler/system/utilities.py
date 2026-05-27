from time import monotonic, sleep

from sqlalchemy import text


def wait_for_system_table(
    engine,
    query: str,
    expected_count: int,
    timeout_seconds: int = 60,
    interval_seconds: int = 5,
) -> None:
    """Poll the query until the expected rows are visible."""
    deadline = monotonic() + timeout_seconds
    last_rows: list[dict[str, object]] = []

    while monotonic() < deadline:
        with engine.connect() as connection:
            rows = connection.execute(text(query)).mappings().all()

        last_rows = list(rows)
        if len(last_rows) >= expected_count:
            return

        sleep(interval_seconds)

    raise AssertionError(
        f"Timed out after {timeout_seconds}s waiting for {expected_count} rows. "
        f"Last observed row count: {len(last_rows)}"
    )
