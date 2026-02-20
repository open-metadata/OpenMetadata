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
Slack Link Monitor - validates Slack invite links are still active.
Uses Playwright to render the page and check for expiration messages.
"""

import logging
import os
from typing import Optional

from playwright.sync_api import sync_playwright
from slack_sdk.webhook import WebhookClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def get_required_env_var(var_name: str) -> str:
    value: Optional[str] = os.getenv(var_name)
    if value is None:
        raise RuntimeError(f"Required environment variable '{var_name}' is not set.")
    return value


slack_webhook_url: str = get_required_env_var("SLACK_WEBHOOK_URL")
github_server_url: str = get_required_env_var("GITHUB_SERVER_URL")
github_repository: str = get_required_env_var("GITHUB_REPOSITORY")
github_run_id: str = get_required_env_var("GITHUB_RUN_ID")

logger.info("Successfully loaded all required environment variables.")
logger.info(f"Repo: {github_repository}, Run ID: {github_run_id}")


def send_slack_alert(message: str) -> None:
    slack_client = WebhookClient(url=slack_webhook_url)
    full_message = f"{message}\nWorkflow run: {github_server_url}/{github_repository}/actions/runs/{github_run_id}"
    slack_client.send(text=full_message)


def validate_slack_link(url: str) -> bool:
    """
    Returns True if the Slack invite link is active, False if expired.
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            page = browser.new_page()
            page.goto(url, wait_until="networkidle", timeout=30000)
            content = page.content()
            return "This link is no longer active" not in content
        finally:
            browser.close()


def main():
    slack_url_map = {
        "open-metadata": "https://slack.open-metadata.org",
        "free-tier-support": "https://free-tier-support.getcollate.io/",
    }

    errors = []

    for product_type, slack_url in slack_url_map.items():
        try:
            logger.info(f"Checking {product_type}: {slack_url}")
            is_active = validate_slack_link(slack_url)

            if is_active:
                logger.info(f"{product_type} slack link is active")
            else:
                error_msg = f"🔥 {product_type} slack link is EXPIRED 🔥"
                logger.error(error_msg)
                send_slack_alert(error_msg)
                errors.append(error_msg)

        except Exception as err:
            error_msg = f"🔥 {product_type} monitoring error: {err} 🔥"
            logger.error(error_msg)
            send_slack_alert(error_msg)
            errors.append(error_msg)

    if errors:
        raise RuntimeError(f"Monitoring failed with {len(errors)} error(s)")


if __name__ == "__main__":
    main()
