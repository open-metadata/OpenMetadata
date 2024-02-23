---
title: Run the ingestion from GitHub Actions
slug: /deployment/ingestion/external/github-actions
---

{% partial file="/v1.3/deployment/external-ingestion.md" /%}

# Run the ingestion from GitHub Actions

{% note %}

You can find a fully working demo of this setup [here](https://github.com/open-metadata/openmetadata-demo/tree/main/ingestion-github-actions).

{% /note %}

The process to run the ingestion from GitHub Actions is the same as running it from anywhere else.
1. Get the YAML configuration,
2. Prepare the Python Script
3. Schedule the Ingestion

## 1. YAML Configuration

For any connector and workflow, you can pick it up from its doc [page](/connectors).

## 2. Prepare the Python Script

In the GitHub Action we will just be triggering a custom Python script. This script will:

- Load the secrets from environment variables (we don't want any security risks!),
- Prepare the Workflow class from the Ingestion Framework that contains all the logic on how to run the metadata ingestion,
- Execute the workflow and log the results.

- A simplified version of such script looks like follows:

```python
import os
import yaml

from metadata.workflow.metadata import MetadataWorkflow

from metadata.workflow.workflow_output_handler import print_status

CONFIG = f"""
source:
  type: snowflake
  serviceName: snowflake_from_github_actions
  serviceConnection:
    config:
      type: Snowflake
      username: {os.getenv('SNOWFLAKE_USERNAME')}
...
"""


def run():
    workflow_config = yaml.safe_load(CONFIG)
    workflow = MetadataWorkflow.create(workflow_config)
    workflow.execute()
    workflow.raise_from_status()
    print_status(workflow)
    workflow.stop()


if __name__ == "__main__":
    run()
```

Note how we are securing the credentials using environment variables. You will need to create these env vars in your
GitHub repository. Follow the GitHub [docs](https://docs.github.com/en/actions/security-guides/encrypted-secrets) for
more information on how to create and use Secrets.

In the end, we'll map these secrets to environment variables in the process, that we can pick up with `os.getenv`.

## 3. Schedule the Ingestion

Now that we have all the ingredients, we just need to build a simple GitHub Actions with the following steps:

- Install Python
- Prepare virtual environment with the openmetadata-ingestion package
- Run the script!

- It is as simple as this. Internally the function run we created will be sending the results to the OpenMetadata server, so there's nothing else we need to do here.

A first version of the action could be:

```yaml
name: ingest-snowflake
on:
  # Any expression you'd like here
  schedule:
    - cron:  '0 */2 * * *'
  # If you also want to execute it manually
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

jobs:
  ingest:
    runs-on: ubuntu-latest

    steps:
    # Pick up the repository code, where the script lives
    - name: Checkout
      uses: actions/checkout@v3

    # Prepare Python in the GitHub Agent
    - name: Set up Python 3.9
      uses: actions/setup-python@v4
      with:
        python-version: 3.9

    # Install the dependencies. Make sure that the client version matches the server!
    - name: Install Deps
      run: |
        python -m venv env
        source env/bin/activate
        pip install "openmetadata-ingestion[snowflake]==1.0.2.0"

    - name: Run Ingestion
      run: |
        source env/bin/activate
        python ingestion-github-actions/snowflake_ingestion.py
      # Add the env vars we need to load the snowflake credentials
      env:
         SNOWFLAKE_USERNAME: ${{ secrets.SNOWFLAKE_USERNAME }}
         SNOWFLAKE_PASSWORD: ${{ secrets.SNOWFLAKE_PASSWORD }}
         SNOWFLAKE_WAREHOUSE: ${{ secrets.SNOWFLAKE_WAREHOUSE }}
         SNOWFLAKE_ACCOUNT: ${{ secrets.SNOWFLAKE_ACCOUNT }}
         SBX_JWT: ${{ secrets.SBX_JWT }}
```

## [Optional] - Getting Alerts in Slack

A very interesting option that GitHub Actions provide is the ability to get alerts in Slack after our action fails.

This can become specially useful if we want to be notified when our metadata ingestion is not working as expected. 
We can use the same setup as above with a couple of slight changes:

```yaml
    - name: Run Ingestion
      id: ingestion
      continue-on-error: true
      run: |
        source env/bin/activate
        python ingestion-github-actions/snowflake_ingestion.py
      # Add the env vars we need to load the snowflake credentials
      env:
         SNOWFLAKE_USERNAME: ${{ secrets.SNOWFLAKE_USERNAME }}
         SNOWFLAKE_PASSWORD: ${{ secrets.SNOWFLAKE_PASSWORD }}
         SNOWFLAKE_WAREHOUSE: ${{ secrets.SNOWFLAKE_WAREHOUSE }}
         SNOWFLAKE_ACCOUNT: ${{ secrets.SNOWFLAKE_ACCOUNT }}
         SBX_JWT: ${{ secrets.SBX_JWT }}

    - name: Slack on Failure
      if: steps.ingestion.outcome != 'success'
      uses: slackapi/slack-github-action@v1.23.0
      with:
        payload: |
          {
            "text": "🔥 Metadata ingestion failed! 🔥"
          }
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
        SLACK_WEBHOOK_TYPE: INCOMING_WEBHOOK

    - name: Force failure
      if: steps.ingestion.outcome != 'success'
      run: |
        exit 1
```

We have:

- Marked the `Run Ingestion` step with a specific `id` and with `continue-on-error: true`. If anything happens, we don't want the action to stop.
- We added a step with `slackapi/slack-github-action@v1.23.0`. By passing a Slack Webhook link via a secret, we can send any payload to a 
- specific Slack channel. You can find more info on how to set up a Slack Webhook [here](https://api.slack.com/messaging/webhooks).
- If our `ingestion` step fails, we still want to mark the action as failed, so we are forcing the failure we skipped before.
