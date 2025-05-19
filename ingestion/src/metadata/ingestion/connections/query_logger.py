"""
Query tracking implementation using SQLAlchemy event listeners
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple, Union

from pydantic import BaseModel, ConfigDict
from sqlalchemy.event import listen
from sqlalchemy.sql.elements import TextClause

from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class QueryInfo(BaseModel):
    """Class to store information about a query execution"""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    statement: Union[str, TextClause]
    parameters: Optional[Dict[str, Any]]
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_ms: Optional[float] = None
    error: Optional[Exception] = None


class QueryLogger:
    """Class to track SQL query execution using SQLAlchemy event listeners"""

    def __init__(self):
        self._current_query: Optional[QueryInfo] = None

    def before_cursor_execute(
        self,
        conn: Any,
        cursor: Any,
        statement: Union[str, TextClause],
        parameters: Optional[Dict[str, Any]],
        context: Any,
        executemany: bool,
    ) -> Tuple[Union[str, TextClause], Optional[Dict[str, Any]]]:
        """Event listener for before cursor execute"""
        self._current_query = QueryInfo(
            statement=statement,
            parameters=parameters,
            start_time=datetime.now(timezone.utc),
        )
        return statement, parameters

    def after_cursor_execute(
        self,
        conn: Any,
        cursor: Any,
        statement: Union[str, TextClause],
        parameters: Optional[Dict[str, Any]],
        context: Any,
        executemany: bool,
    ) -> None:
        """Event listener for after cursor execute"""
        if self._current_query:
            query = self._current_query
            query.end_time = datetime.now(timezone.utc)
            query.duration_ms = (
                query.end_time - query.start_time
            ).total_seconds() * 1000

            logger.debug(
                "Query execution details:\n"
                f"  Start Time: {query.start_time}\n"
                f"  End Time: {query.end_time}\n"
                f"  Duration: {query.duration_ms:.2f} ms\n"
                f"  Query: {query.statement}\n"
                f"  Parameters: {query.parameters}"
            )

            self._current_query = None


def attach_query_tracker(engine: Any):
    """
    Attach query tracking event listeners to a SQLAlchemy engine

    Args:
        engine: SQLAlchemy engine to attach listeners to

    Returns:
        QueryLogger instance that can be used to access query execution data
    """
    tracker = QueryLogger()

    listen(
        engine,
        "before_cursor_execute",
        tracker.before_cursor_execute,
        retval=True,
    )
    listen(
        engine,
        "after_cursor_execute",
        tracker.after_cursor_execute,
    )
