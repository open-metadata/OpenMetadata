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
Each of the ingestion steps: Source, Sink, Stage,...
"""
import inspect
import traceback
from abc import ABC, abstractmethod
from typing import Iterable, Optional

from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StepSummary,
)
from metadata.ingestion.api.closeable import Closeable
from metadata.ingestion.api.models import Either, Entity, StackTraceError
from metadata.ingestion.api.status import Status
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()


class WorkflowFatalError(Exception):
    """
    To be raised when we need to stop the workflow execution.
    E.g., during a failed Test Connection.
    Anything else will keep the workflow running.
    """


class Step(ABC, Closeable):
    """All Workflow steps must inherit this base class."""

    status: Status

    def __init__(self):
        self.status = Status()

    @classmethod
    @abstractmethod
    def create(
        cls,
        config_dict: dict,
        metadata: OpenMetadata,
        pipeline_name: Optional[str] = None,
    ) -> "Step":
        pass

    def get_status(self) -> Status:
        return self.status

    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def close(self) -> None:
        pass


class Summary(StepSummary):
    """
    Auxiliary class to calculate the summary of all statuses
    """

    @classmethod
    def from_step(cls, step: Step) -> "Summary":
        """Compute summary from Step"""
        return Summary(
            name=step.name,
            records=len(step.status.records),
            updated_records=len(step.status.updated_records),
            warnings=len(step.status.warnings),
            errors=len(step.status.failures),
            filtered=len(step.status.filtered),
            failures=step.status.failures[0:10] if step.status.failures else None,
        )

    def __str__(self):
        return (
            f"{self.name} Summary: [{self.records} Records, [{self.updated_records} Updated Records,"
            f" {self.warnings} Warnings, {self.errors} Errors, {self.filtered} Filtered]"
        )


class ReturnStep(Step, ABC):
    """Steps that run by returning a single unit"""

    @abstractmethod
    def _run(self, record: Entity) -> Either:
        """
        Main entrypoint to execute the step
        """

    def run(self, record: Entity) -> Optional[Entity]:
        """
        Run the step and handle the status and exceptions
        """
        try:
            result: Either = self._run(record)
            if result:
                if result.left is not None:
                    self.status.failed(result.left)
                    return None

                if result.right is not None:
                    self.status.scanned(result.right)
                    return result.right
        except WorkflowFatalError as err:
            logger.error(f"Fatal error running step [{self}]: [{err}]")
            raise err
        except AttributeError as exc:
            error = (
                f"Object type defined in `def _run()` "
                f"{inspect.getsourcefile(self._run)} is not an Either: [{exc}]"
            )
            logger.warning(error)
            self.status.failed(
                StackTraceError(
                    name="Not an Either",
                    error=error,
                    stackTrace=traceback.format_exc(),
                )
            )
        except Exception as exc:
            error = f"Unhandled exception during workflow processing: [{exc}]"
            logger.warning(error)
            self.status.failed(
                StackTraceError(
                    name="Unhandled", error=error, stackTrace=traceback.format_exc()
                )
            )

        return None


class StageStep(Step, ABC):
    """Steps that run by returning a single unit"""

    @abstractmethod
    def _run(self, record: Entity) -> Iterable[Either[str]]:
        """
        Main entrypoint to execute the step.

        Note that the goal of this step is to store the
        processed data somewhere (e.g., a file). We will
        return an iterable to keep track of the processed
        entities / exceptions, but the next step (Bulk Sink)
        won't read these results. It will directly
        pick up the file components.
        """

    def run(self, record: Entity) -> None:
        """
        Run the step and handle the status and exceptions.
        """
        try:
            for result in self._run(record):
                if result.left is not None:
                    self.status.failed(result.left)

                if result.right is not None:
                    self.status.scanned(result.right)
        except WorkflowFatalError as err:
            logger.error(f"Fatal error running step [{self}]: [{err}]")
            raise err
        except AttributeError as exc:
            error = (
                f"Object type defined in `def _run()` "
                f"{inspect.getsourcefile(self._run)} is not an Either: [{exc}]"
            )
            logger.warning(error)
            self.status.failed(
                StackTraceError(
                    name="Not an Either",
                    error=error,
                    stackTrace=traceback.format_exc(),
                )
            )
        except Exception as exc:
            error = f"Unhandled exception during workflow processing: [{exc}]"
            logger.warning(error)
            self.status.failed(
                StackTraceError(
                    name="Unhandled", error=error, stackTrace=traceback.format_exc()
                )
            )


class IterStep(Step, ABC):
    """Steps that are run as Iterables"""

    @abstractmethod
    def _iter(self) -> Iterable[Either]:
        """Main entrypoint to run through the Iterator"""

    def run(self) -> Iterable[Optional[Entity]]:
        """
        Run the step and handle the status and exceptions

        Note that we are overwriting the default run implementation
        in order to create a generator with `yield`.
        """
        try:
            for result in self._iter():
                if result.left is not None:
                    self.status.failed(result.left)
                    yield None

                if result.right is not None:
                    self.status.scanned(result.right)
                    yield result.right
        except WorkflowFatalError as err:
            logger.error(f"Fatal error running step [{self}]: [{err}]")
            raise err
        except AttributeError as exc:
            error = (
                f"Object type defined in `def _iter()` "
                f"{inspect.getsourcefile(self._iter)} is not an Either: [{exc}]"
            )
            logger.warning(error)
            self.status.failed(
                StackTraceError(
                    name="Not an Either",
                    error=error,
                    stackTrace=traceback.format_exc(),
                )
            )
        except Exception as exc:
            error = f"Encountered exception running step [{self}]: [{exc}]"
            logger.warning(error)
            self.status.failed(
                StackTraceError(
                    name="Unhandled", error=error, stackTrace=traceback.format_exc()
                )
            )


class BulkStep(Step, ABC):
    """
    Step that executes a single method, doing all
    the processing in bulk
    """

    @abstractmethod
    def run(self) -> None:
        pass
