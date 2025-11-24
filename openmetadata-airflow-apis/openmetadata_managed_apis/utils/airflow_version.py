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

import airflow
from packaging import version


def is_airflow_3_or_higher() -> bool:
    """
    Check if the current Airflow version is 3.x or higher.

    Returns:
        bool: True if Airflow version is 3.x or higher, False otherwise
    """
    current_version = version.parse(airflow.__version__)
    return current_version.major >= 3


def get_base_url_config() -> tuple[str, str]:
    """
    Get the configuration section and key for BASE_URL based on Airflow version.

    In Airflow 3.x, BASE_URL moved from [webserver] to [api] section.

    Returns:
        tuple: (section, key) for the BASE_URL configuration
    """
    if is_airflow_3_or_higher():
        return ("api", "BASE_URL")
    return ("webserver", "BASE_URL")
