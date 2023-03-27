#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""
Classes and methods to handle connection testing when
creating a service
"""
import traceback
from datetime import datetime
from functools import partial
from typing import Callable, List, Optional

from pydantic import BaseModel
from sqlalchemy.engine import Engine
from sqlalchemy.inspection import inspect

from metadata.generated.schema.api.automations.createWorkflow import (
    CreateWorkflowRequest,
)
from metadata.generated.schema.entity.automations.workflow import (
    Workflow as AutomationWorkflow,
)
from metadata.generated.schema.entity.automations.workflow import WorkflowStatus
from metadata.generated.schema.entity.services.connections.testConnectionDefinition import (
    TestConnectionDefinition,
)
from metadata.generated.schema.entity.services.connections.testConnectionResult import (
    StatusType,
    TestConnectionResult,
    TestConnectionStepResult,
)
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.profiler.orm.functions.conn_test import ConnTestFn
from metadata.utils.logger import cli_logger
from metadata.utils.timeout import timeout

logger = cli_logger()


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
    description: Optional[str] = None
    mandatory: bool = True


class TestConnectionIngestionResult(BaseModel):
    failed: List[str] = []
    success: List[str] = []
    warning: List[str] = []


def _test_connection_steps(
    metadata: OpenMetadata,
    steps: List[TestConnectionStep],
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> None:
    """
    Run all the function steps and raise any errors
    """

    if automation_workflow:
        _test_connection_steps_automation_workflow(
            metadata=metadata, steps=steps, automation_workflow=automation_workflow
        )

    else:
        _test_connection_steps_during_ingestion(steps=steps)


def _test_connection_steps_automation_workflow(
    metadata: OpenMetadata,
    steps: List[TestConnectionStep],
    automation_workflow: Optional[AutomationWorkflow],
) -> None:
    """
    Run the test connection as part of the automation workflow
    We need to update the automation workflow in each step
    """
    test_connection_result = TestConnectionResult(
        status=StatusType.Running,
        steps=[],
    )
    try:
        for step in steps:
            try:
                step.function()
                test_connection_result.steps.append(
                    TestConnectionStepResult(
                        name=step.name,
                        mandatory=step.mandatory,
                        passed=True,
                    )
                )
            except Exception as err:
                test_connection_result.steps.append(
                    TestConnectionStepResult(
                        name=step.name,
                        mandatory=step.mandatory,
                        passed=False,
                        message=str(err),
                    )
                )

            test_connection_result.lastUpdatedAt = datetime.now().timestamp()
            updated_workflow = CreateWorkflowRequest(
                name=automation_workflow.name,
                description=automation_workflow.description,
                workflowType=automation_workflow.workflowType,
                request=automation_workflow.request,
                response=test_connection_result,
                status=WorkflowStatus.Running,
            )
            metadata.create_or_update(updated_workflow)

        test_connection_result.lastUpdatedAt = datetime.now().timestamp()

        test_connection_result.status = (
            StatusType.Failed
            if any(step for step in test_connection_result.steps if not step.passed)
            else StatusType.Successful
        )

        metadata.create_or_update(
            CreateWorkflowRequest(
                name=automation_workflow.name,
                description=automation_workflow.description,
                workflowType=automation_workflow.workflowType,
                request=automation_workflow.request,
                response=test_connection_result,
                status=WorkflowStatus.Successful,
            )
        )

    except Exception as err:
        logger.error(
            f"Wild error happened while testing the connection in the workflow - {err}"
        )
        logger.debug(traceback.format_exc())
        test_connection_result.lastUpdatedAt = datetime.now().timestamp()
        metadata.create_or_update(
            CreateWorkflowRequest(
                name=automation_workflow.name,
                description=automation_workflow.description,
                workflowType=automation_workflow.workflowType,
                request=automation_workflow.request,
                response=test_connection_result,
                status=WorkflowStatus.Failed,
            )
        )


def _test_connection_steps_during_ingestion(steps: List[TestConnectionStep]) -> None:
    """
    Run the test connection as part of the ingestion workflow
    Raise an exception if something fails
    """
    test_connection_result = TestConnectionIngestionResult()
    for step in steps:
        try:
            step.function()
            test_connection_result.success.append(f"'{step.name}': Pass")

        except Exception as exc:
            logger.debug(traceback.format_exc())
            logger.warning(f"{step.name}-{exc}")
            if step.mandatory:
                test_connection_result.failed.append(
                    f"'{step.name}': This is a mandatory step and we won't be able to extract"
                    f"necessary metadata. Failed due to: {exc}"
                )

            else:
                test_connection_result.warning.append(
                    f"'{step.name}': This is a optional and the ingestion will continue to work as expected."
                    f"Failed due to: {exc}"
                )

    logger.info("Test connection results:")
    logger.info(test_connection_result)

    if test_connection_result.failed:
        raise SourceConnectionException(
            f"Some steps failed when testing the connection: [{test_connection_result}]"
        )


def test_connection_steps(
    metadata: OpenMetadata,
    service_fqn: str,
    test_fn: dict,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: int = 3 * 60,
) -> None:
    """
    Test the connection steps with a given timeout

    Test that we can connect to the source using the given connection
    and extract the metadata
    :return: None or raise an exception if we cannot connect
    """

    test_connection_definition: TestConnectionDefinition = metadata.get_by_name(
        entity=TestConnectionDefinition,
        fqn=service_fqn,
    )

    if not test_connection_definition:
        raise SourceConnectionException(
            f"Test connection definition for {service_fqn} not found please validate the token."
        )

    steps = [
        TestConnectionStep(
            name=step.name,
            description=step.description,
            mandatory=step.mandatory,
            function=test_fn[step.name],
        )
        for step in test_connection_definition.steps
    ]

    return timeout(timeout_seconds)(_test_connection_steps)(
        metadata, steps, automation_workflow
    )


def test_connection_engine_step(connection: Engine) -> None:
    """
    Generic step to validate the connection against a db
    """
    with connection.connect() as conn:
        conn.execute(ConnTestFn())


def test_connection_db_common(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    queries: dict = None,
    timeout_seconds: int = 3 * 60,
) -> TestConnectionResult:

    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow

    Args:

    metadata: Metadata Client to interact with the backend APIs
    engine: SqlAlchemy Engine
    service_connection: Service connection object of data source
    automation_workflow: Automation Workflow object expected when
                         test connection is hit via UI/Airflow
    queries: expected when some queries has to be executed as part of
             test connection
    expected format for queries would be <TestConnectionStep>:<Query>
    queries = {
        "GetQueries": "select * from query_log",
    }
    """

    queries = queries or {}

    test_fn = {
        "CheckAccess": partial(test_connection_engine_step, engine),
        "GetSchemas": partial(execute_inspector_func, engine, "get_schema_names"),
        "GetTables": partial(execute_inspector_func, engine, "get_table_names"),
        "GetViews": partial(execute_inspector_func, engine, "get_view_names"),
    }

    for key, query in queries.items():
        test_fn[key] = partial(test_query, statement=query, engine=engine)

    test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_fqn=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )


def test_connection_db_schema_sources(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    queries: dict = None,
) -> None:
    """
    Test connection. This can be executed either as part
    of a metadata workflow or during an Automation Workflow

    Args:

    metadata: Metadata Client to interact with the backend APIs
    engine: SqlAlchemy Engine
    service_connection: Service connection object of data source
    automation_workflow: Automation Workflow object expected when
                         test connection is hit via UI/Airflow
    queries: expected when some queries has to be executed as part of
             test connection
    expected format for queries would be <TestConnectionStep>:<Query>
    queries = {
        "GetQueries": "select * from query_log",
    }
    """
    queries = queries or {}

    def custom_executor(engine, inspector_fn_str: str):
        """
        Check if we can list tables or views from a given schema
        or a random one
        """

        inspector = inspect(engine)
        inspector_fn = getattr(inspector, inspector_fn_str)

        if service_connection.databaseSchema:
            inspector_fn(service_connection.databaseSchema)
        else:
            schema_name = inspector.get_schema_names() or []
            for schema in schema_name:
                if schema.lower() not in ("information_schema", "performance_schema"):
                    inspector_fn(schema)
                    break

    test_fn = {
        "CheckAccess": partial(test_connection_engine_step, engine),
        "GetSchemas": partial(execute_inspector_func, engine, "get_schema_names"),
        "GetTables": partial(custom_executor, engine, "get_table_names"),
        "GetViews": partial(custom_executor, engine, "get_view_names"),
    }

    for key, query in queries.items():
        test_fn[key] = partial(test_query, statement=query, engine=engine)

    test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_fqn=service_connection.type.value,
        automation_workflow=automation_workflow,
    )


def test_query(engine: Engine, statement: str):
    """
    Method used to execute the given query and fetch a result
    to test if user has access to the tables specified
    in the sql statement
    """
    engine.execute(statement).fetchone()


def execute_inspector_func(engine: Engine, func_name: str):
    """
    Method to test connection via inspector functions,
    this function creates the inspector object and fetches
    the function with name `func_name` and executes it
    """

    inspector = inspect(engine)
    inspector_fn = getattr(inspector, func_name)
    inspector_fn()
