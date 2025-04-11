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
import argparse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Monitor Slack link status")
    parser.add_argument(
        "deployment_type",
        choices=["open-metadata", "free-tier-support"],
        default="open-metadata",
        help="Deployment type: open-metadata or free-tier-support",
    )

    args = parser.parse_args()
    slack_url = None
    if args.deployment_type == "open-metadata":
        slack_url = "https://slack.open-metadata.org"
    elif args.deployment_type == "free-tier-support":
        slack_url = "https://free-tier-support.getcollate.io/"

    if slack_url is None:
        raise ValueError(f"Invalid deployment type: {args.deployment_type}")

    res = None
    try:
        res = requests.post(
            "https://linkmonitor.onrender.com/api/v1/validate",
            headers={"Content-Type": "application/json"},
            json={"url": slack_url},
        )
        logger.info(f"Status: {res.status_code} {res.text}")
        
        if res.json().get("status") != "active":
            raise RuntimeError("Expired status!")
    except RuntimeError as err:
        raise err
    except Exception as err:
        error_msg = f"Something went wrong fetching the data - [{err}]"
        if res is not None:
            error_msg += f" [{res.text}]"
        logger.error(error_msg)
        raise err


if __name__ == "__main__":
    main()
