import json
from unittest import TestCase

from metadata.ingestion.api.workflow import Workflow

config = """
{
  "source": {
    "type": "sample-data",
    "config": {
      "sample_data_folder": "examples/sample_data/"
    }
  },
  "stage": {
    "type": "file",
    "config": {
      "filename": "/tmp/stage_test"
    }
  },
  "metadata_server": {
    "type": "metadata-server",
    "config": {
      "api_endpoint": "http://localhost:8585/api",
      "auth_provider_type": "no-auth"
    }
  }
}
"""


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
