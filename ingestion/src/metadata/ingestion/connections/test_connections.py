from typing import Callable

from pydantic import BaseModel
from sqlalchemy.exc import OperationalError

from metadata.ingestion.connections.secrets import connection_with_options_secrets
from metadata.orm_profiler.orm.functions.conn_test import ConnTestFn
from metadata.utils.timeout import timeout


class SourceConnectionException(Exception):
    """
    Raised when we cannot connect to the source
    """


class TestConnectionStep(BaseModel):
    """
    Function and step name to test.

    The function should be ready to be called.

    If it needs arguments, use `partial` to send a pre-filled
    Callable. Example

    ```
    def suma(a, b):
        return a + b

    step_1 = TestConnectionStep(
        function=partial(suma, a=1, b=1),
        name="suma"
    )
    ```

    so that we can execute `step_1.function()`
    """

    function: Callable
    name: str


@timeout(seconds=120)
@connection_with_options_secrets
def test_connection_db_common(connection) -> None:
    """
    Default implementation is the engine to test.

    Test that we can connect to the source using the given engine
    :param connection: Engine to test
    :return: None or raise an exception if we cannot connect
    """
    try:
        with connection.connect() as conn:
            conn.execute(ConnTestFn())
    except OperationalError as err:
        msg = f"Connection error for {connection}: {err}. Check the connection details."
        raise SourceConnectionException(msg) from err
    except Exception as exc:
        msg = f"Unknown error connecting with {connection}: {exc}."
        raise SourceConnectionException(msg) from exc
