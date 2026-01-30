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

import logging
import requests
from slack_sdk.webhook import WebhookClient
import os
from typing import Optional


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def get_required_env_var(var_name: str) -> str:
    """
    Retrieves an environment variable by name, raising RuntimeError if it's not set.
    """
    value: Optional[str] = os.getenv(var_name)
    if value is None:
        raise RuntimeError(f"Required environment variable '{var_name}' is not set.")
    return value


# Get the variables using the helper function
slack_webhook_url: str = get_required_env_var("SLACK_WEBHOOK_URL")
slack_webhook_type: str = get_required_env_var("SLACK_WEBHOOK_TYPE")
github_server_url: str = get_required_env_var("GITHUB_SERVER_URL")
github_repository: str = get_required_env_var("GITHUB_REPOSITORY")
github_run_id: str = get_required_env_var("GITHUB_RUN_ID")

# Now you can use the variables
logger.info("Successfully loaded all required environment variables.")
logger.info(f"Repo: {github_repository}, Run ID: {github_run_id}")


def send_slack_alert(message: str) -> None:
    slack_client = WebhookClient(url=slack_webhook_url)
    full_message = f"{message}\nWorkflow run: {github_server_url}/{github_repository}/actions/runs/{github_run_id}"
    slack_client.send(text=full_message)


def main():
    slack_url_map = {
        "open-metadata": "https://slack.open-metadata.org",
        "free-tier-support": "https://free-tier-support.getcollate.io/",
    }

    errors = []

    for product_type, slack_url in slack_url_map.items():
        res = None
        try:
            res = requests.post(
                "https://linkmonitor.onrender.com/api/v1/validate",
                headers={"Content-Type": "application/json"},
                json={"url": slack_url},
                timeout=30,
            )
            logger.info(f"Status: {res.status_code} {res.text}")

            if res.status_code != 200:
                raise RuntimeError(
                    f"API returned status {res.status_code}: {res.text}"
                )

            try:
                response_data = res.json()
            except requests.exceptions.JSONDecodeError as json_err:
                raise RuntimeError(
                    f"Invalid JSON response: {res.text}"
                ) from json_err

            if response_data.get("status") != "active":
                raise RuntimeError("Expired status!")

        except RuntimeError as err:
            error_msg = f"🔥 {product_type} slack link check failed: {err} 🔥"
            logger.error(error_msg)
            send_slack_alert(error_msg)
            errors.append(error_msg)
        except Exception as err:
            error_msg = f"🔥 {product_type} monitoring error: {err}"
            if res is not None:
                error_msg += f" [Response: {res.text}]"
            error_msg += " 🔥"
            logger.error(error_msg)
            send_slack_alert(error_msg)
            errors.append(error_msg)

    if errors:
        raise RuntimeError(f"Monitoring failed with {len(errors)} error(s)")


if __name__ == "__main__":
    main()
