import json
from unittest import TestCase
import pytest
from metadata.ingestion.api.workflow import Workflow


config = {}




class WorkflowTest(TestCase):
    def test_execute_200(self):
        """
        stage/file.py must be compatible with source/sample_data.py,
        this test try to catch if one becomes incompatible with the other
        by running a workflow that includes both of them.
        """
        workflow = Workflow.create(json.loads(config))
        workflow.execute()
        workflow.stop()
        self.assertTrue(True)
