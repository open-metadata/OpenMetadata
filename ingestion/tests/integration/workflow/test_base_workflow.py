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
Validate the logic and status handling of the base workflow
"""
from typing import Iterable, Tuple
from unittest import TestCase

import pytest

from metadata.config.common import WorkflowExecutionError
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.ingestionPipelines.status import (
    StackTraceError,
)
from metadata.generated.schema.metadataIngestion.databaseServiceMetadataPipeline import (
    DatabaseServiceMetadataPipeline,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
    Source,
    SourceConfig,
    WorkflowConfig,
)
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.api.models import Either
from metadata.ingestion.api.step import Step
from metadata.ingestion.api.steps import Sink
from metadata.ingestion.api.steps import Source as WorkflowSource
from metadata.workflow.ingestion import IngestionWorkflow


class SimpleSource(WorkflowSource):
    """
    Simple Source for testing
    """

    def prepare(self):
        """Nothing to do"""

    def test_connection(self) -> None:
        """Nothing to do"""

    @classmethod
    def create(cls, _: dict, __: OpenMetadataConnection) -> "SimpleSource":
        return cls()

    def close(self) -> None:
        """Nothing to do"""

    def _iter(self, *args, **kwargs) -> Iterable[Either]:
        for element in range(0, 5):
            yield Either(right=element)


class BrokenSource(WorkflowSource):
    """Source not returning an Either"""

    def prepare(self):
        """Nothing to do"""

    def test_connection(self) -> None:
        """Nothing to do"""

    @classmethod
    def create(cls, _: dict, __: OpenMetadataConnection) -> "SimpleSource":
        return cls()

    def close(self) -> None:
        """Nothing to do"""

    def _iter(self, *args, **kwargs) -> Iterable[int]:
        for element in range(0, 5):
            yield int(element)


class SimpleSink(Sink):
    """
    Simple Sink for testing
    """

    def _run(self, element: int) -> Either:
        if element == 2:
            return Either(
                left=StackTraceError(name="bum", error="kaboom", stackTrace="trace")
            )

        return Either(right=element)

    @classmethod
    def create(cls, _: dict, __: OpenMetadataConnection) -> "SimpleSink":
        return cls()

    def close(self) -> None:
        """Nothing to do"""


class SimpleWorkflow(IngestionWorkflow):
    """
    Simple Workflow for testing
    """

    def set_steps(self):
        self.source = SimpleSource()

        self.steps: Tuple[Step] = (SimpleSink(),)


class BrokenWorkflow(IngestionWorkflow):
    """
    Simple Workflow for testing
    """

    def set_steps(self):
        self.source = BrokenSource()

        self.steps: Tuple[Step] = (SimpleSink(),)


# Pass only the required details so that the workflow can be initialized
config = OpenMetadataWorkflowConfig(
    source=Source(
        type="simple",
        serviceName="test",
        sourceConfig=SourceConfig(config=DatabaseServiceMetadataPipeline()),
    ),
    workflowConfig=WorkflowConfig(
        openMetadataServerConfig=OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
            authProvider="openmetadata",
            securityConfig=OpenMetadataJWTClientConfig(
                jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            ),
        )
    ),
)


class TestBaseWorkflow(TestCase):
    """
    Parent workflow class
    """

    workflow = SimpleWorkflow(config=config)
    broken_workflow = BrokenWorkflow(config=config)

    @pytest.mark.order(1)
    def test_workflow_executes(self):
        self.workflow.execute()

        # We have scanned some information properly
        self.assertTrue(len(self.workflow.source.status.records))

    @pytest.mark.order(2)
    def test_workflow_status(self):
        # Everything is processed properly in the Source
        self.assertEqual(self.workflow.source.status.records, ["0", "1", "2", "3", "4"])
        self.assertEqual(len(self.workflow.source.status.failures), 0)

        # We catch one error in the Sink
        self.assertEqual(len(self.workflow.steps[0].status.records), 4)
        self.assertEqual(len(self.workflow.steps[0].status.failures), 1)

    @pytest.mark.order(3)
    def test_workflow_raise_status(self):
        # We catch the error on the Sink
        self.assertRaises(WorkflowExecutionError, self.workflow.raise_from_status)

    def test_broken_workflow(self):
        """test our broken workflow return expected exc"""
        self.broken_workflow.execute()
        self.assertRaises(
            WorkflowExecutionError, self.broken_workflow.raise_from_status
        )
        self.assertEqual(
            self.broken_workflow.source.status.failures[0].name, "Not an Either"
        )
        assert (
            "workflow/test_base_workflow.py"
            in self.broken_workflow.source.status.failures[0].error
        )
