import json
import os

from metadata.ingestion.api.workflow import Workflow


def main():
    # DockerOperator expects an env var called config
    config = os.environ["config"]

    # Load the config string representation
    workflow_config = json.loads(config)
    workflow = Workflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    workflow.print_status()
    workflow.stop()


if __name__ == "__main__":
    main()
