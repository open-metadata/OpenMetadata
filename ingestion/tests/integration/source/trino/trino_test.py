import json
from unittest import TestCase

from metadata.ingestion.api.workflow import Workflow

config = """
{
  "source": {
    "type": "trino",
    "config": {
      "service_name": "local_trino",
      "host_port": "localhost:8080",
      "username": "user",
      "catalog": "tpcds",
      "database": "tiny"
    }
  },
  "sink": {
    "type": "metadata-rest",
    "config": {}
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
