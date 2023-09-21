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

try:
    res = requests.post(
        "https://www.linkmonitor.dev/api/v1/validate",
        headers={"Content-Type": "application/json"},
        json={"url": "https://slack.open-metadata.org"},
    )
    if res.json().get("status") != "active":
        raise RuntimeError("Expired status!")
except RuntimeError as err:
    raise err
except Exception as err:
    logging.error(f"Something went wrong fetching the data - [{err}]")
    raise err
