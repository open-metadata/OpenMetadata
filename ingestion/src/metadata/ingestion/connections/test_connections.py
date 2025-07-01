#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
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
from metadata.generated.schema.type.basic import Timestamp
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.ingestion.source.connections_utils import kill_active_connections
from metadata.profiler.orm.functions.conn_test import ConnTestFn
from metadata.utils.constants import THREE_MIN
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
    error_message: Optional[str]
    description: Optional[str]
    mandatory: bool = True
    short_circuit: bool = False


class TestConnectionIngestionResult(BaseModel):
    failed: List[str] = []
    success: List[str] = []
    warning: List[str] = []


def _test_connection_steps(
    metadata: OpenMetadata,
    steps: List[TestConnectionStep],
    automation_workflow: Optional[AutomationWorkflow] = None,
) -> TestConnectionResult:
    """
    Run all the function steps and raise any errors
    """

    if automation_workflow:
        return _test_connection_steps_automation_workflow(
            metadata=metadata, steps=steps, automation_workflow=automation_workflow
        )

    return _test_connection_steps_during_ingestion(steps=steps)


def _test_connection_steps_automation_workflow(
    metadata: OpenMetadata,
    steps: List[TestConnectionStep],
    automation_workflow: AutomationWorkflow,
) -> TestConnectionResult:
    """
    Run the test connection as part of the automation workflow
    We need to update the automation workflow in each step
    """
    logger.info("Starting Test Connection Workflow Steps")
    test_connection_result = TestConnectionResult(
        status=StatusType.Running,
        steps=[],
    )
    try:
        for step in steps:
            try:
                logger.info(f"Running {step.name}...")
                step.function()
                test_connection_result.steps.append(
                    TestConnectionStepResult(
                        name=step.name,
                        mandatory=step.mandatory,
                        passed=True,
                    )
                )
            except Exception as err:
                logger.debug(traceback.format_exc())
                logger.warning(f"{step.name}-{err}")
                test_connection_result.steps.append(
                    TestConnectionStepResult(
                        name=step.name,
                        mandatory=step.mandatory,
                        passed=False,
                        message=step.error_message,
                        errorLog=str(err),
                    )
                )
                if step.short_circuit:
                    # break the workflow if the step is a short circuit step
                    break

            test_connection_result.lastUpdatedAt = Timestamp(
                int(datetime.now().timestamp() * 1000)
            )
            metadata.patch_automation_workflow_response(
                automation_workflow, test_connection_result, WorkflowStatus.Running
            )

        test_connection_result.lastUpdatedAt = Timestamp(
            int(datetime.now().timestamp() * 1000)
        )

        test_connection_result.status = (
            StatusType.Failed
            if any(step for step in test_connection_result.steps if not step.passed)
            else StatusType.Successful
        )

        logger.info("Updating Workflow Response")
        metadata.patch_automation_workflow_response(
            automation_workflow, test_connection_result, WorkflowStatus.Successful
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

    return test_connection_result


def _test_connection_steps_during_ingestion(
    steps: List[TestConnectionStep],
) -> TestConnectionResult:
    """Run the test connection steps during ingestion"""
    test_connection_result = TestConnectionResult(
        status=StatusType.Running,
        steps=[],
    )
    for step in steps:
        try:
            logger.info(f"Running {step.name}...")
            step.function()
            test_connection_result.steps.append(
                TestConnectionStepResult(
                    name=step.name,
                    mandatory=step.mandatory,
                    passed=True,
                )
            )
        except Exception as err:
            logger.debug(traceback.format_exc())
            logger.error(f"{step.name}-{err}")
            test_connection_result.steps.append(
                TestConnectionStepResult(
                    name=step.name,
                    mandatory=step.mandatory,
                    passed=False,
                    message=step.error_message,
                    errorLog=str(err),
                )
            )
            if step.short_circuit:
                # break the workflow if the step is a short circuit step
                break

    logger.info("Test connection results:")
    logger.info(test_connection_result)

    return test_connection_result


def raise_test_connection_exception(result: TestConnectionResult) -> None:
    """Raise if needed an exception for the test connection"""
    for step in result.steps:
        if not step.passed and step.mandatory:
            raise SourceConnectionException(
                f"Failed to run the test connection step: {step.name}"
            )
        if not step.passed:
            logger.warning(
                f"You might be missing metadata in: {step.name} due to {step.message}"
            )


def test_connection_steps(
    metadata: OpenMetadata,
    service_type: str,
    test_fn: dict,
    automation_workflow: Optional[AutomationWorkflow] = None,
    timeout_seconds: Optional[int] = THREE_MIN,
) -> TestConnectionResult:
    """
    Test the connection steps with a given timeout

    Test that we can connect to the source using the given connection
    and extract the metadata
    :return: None or raise an exception if we cannot connect
    """

    test_connection_def_fqn = service_type + ".testConnectionDefinition"

    test_connection_definition: TestConnectionDefinition = metadata.get_by_name(
        entity=TestConnectionDefinition,
        fqn=test_connection_def_fqn,
    )

    if not test_connection_definition:
        raise SourceConnectionException(
            f"Test connection definition for {test_connection_def_fqn} not found! Make sure the"
            " ingestion-bot JWT token is valid and that the Workflow is deployed with the latest one."
            " If this error persists, recreate the JWT token and redeploy the Workflow."
        )

    steps = [
        TestConnectionStep(
            name=step.name,
            description=step.description,
            mandatory=step.mandatory,
            function=test_fn[step.name],
            error_message=step.errorMessage,
            short_circuit=step.shortCircuit,
        )
        for step in test_connection_definition.steps
    ]

    if timeout_seconds:
        return timeout(timeout_seconds)(_test_connection_steps)(
            metadata, steps, automation_workflow
        )

    return _test_connection_steps(metadata, steps, automation_workflow)


def test_connection_engine_step(connection: Engine) -> None:
    """
    Generic step to validate the connection against a db
    """
    with connection.connect() as conn:
        result = conn.execute(ConnTestFn())
        if result:
            result.fetchone()


def test_connection_db_common(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    queries: dict = None,
    timeout_seconds: Optional[int] = THREE_MIN,
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
    queries: expected when some queries have to be executed as part of
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

    result = test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )

    kill_active_connections(engine)

    return result


def test_connection_db_schema_sources(
    metadata: OpenMetadata,
    engine: Engine,
    service_connection,
    automation_workflow: Optional[AutomationWorkflow] = None,
    queries: dict = None,
    timeout_seconds: Optional[int] = THREE_MIN,
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
    queries: expected when some queries have to be executed as part of
             test connection
    expected format for queries would be <TestConnectionStep>:<Query>
    queries = {
        "GetQueries": "select * from query_log",
    }
    """
    queries = queries or {}

    def custom_executor(engine_: Engine, inspector_fn_str: str):
        """
        Check if we can list tables or views from a given schema
        or a random one
        """

        inspector = inspect(engine_)
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

    result = test_connection_steps(
        metadata=metadata,
        test_fn=test_fn,
        service_type=service_connection.type.value,
        automation_workflow=automation_workflow,
        timeout_seconds=timeout_seconds,
    )

    kill_active_connections(engine)

    return result


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
