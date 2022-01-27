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
OpenMetadata Airflow Lineage Backend
"""
import json
import os
from typing import Optional

from airflow.configuration import conf

from metadata.config.common import ConfigModel
from metadata.ingestion.ometa.openmetadata_rest import MetadataServerConfig


class OpenMetadataLineageConfig(ConfigModel):
    """
    Base class for OpenMetada lineage config

    Attributes
        airflow_service_name (str): name of the service
        api_endpoint (str): the endpoint for the API
        auth_provider_type (str):
        secret_key (str):
    """

    airflow_service_name: str = "airflow"
    api_endpoint: str = "http://localhost:8585"
    auth_provider_type: str = "no-auth"
    secret_key: Optional[str] = None


def get_lineage_config() -> OpenMetadataLineageConfig:
    """
    Load the lineage config from airflow_provider_openmetadata.cfg.
    """
    airflow_service_name = conf.get("lineage", "airflow_service_name", fallback=None)
    if airflow_service_name:
        api_endpoint = conf.get(
            "lineage", "openmetadata_api_endpoint", fallback="http://localhost:8585"
        )
        auth_provider_type = conf.get(
            "lineage", "auth_provider_type", fallback="no-auth"
        )
        secret_key = conf.get("lineage", "secret_key", fallback=None)
        return OpenMetadataLineageConfig.parse_obj(
            {
                "airflow_service_name": airflow_service_name,
                "api_endpoint": api_endpoint,
                "auth_provider_type": auth_provider_type,
                "secret_key": secret_key,
            }
        )

    openmetadata_config_file = os.getenv("OPENMETADATA_LINEAGE_CONFIG")
    if openmetadata_config_file:
        with open(openmetadata_config_file, encoding="utf-8") as config_file:
            config = json.load(config_file)
            return OpenMetadataLineageConfig.parse_obj(config)

    return OpenMetadataLineageConfig.parse_obj(
        {
            "airflow_service_name": "airflow",
            "api_endpoint": "http://localhost:8585/api",
            "auth_provider_type": "no-auth",
        }
    )


def get_metadata_config(config: OpenMetadataLineageConfig) -> MetadataServerConfig:
    """
    Return MetadataServerConfig to interact with the API.
    :param config: get_lineage_config()
    """

    return MetadataServerConfig.parse_obj(
        {
            "api_endpoint": config.api_endpoint,
            "auth_provider_type": config.auth_provider_type,
            "secret_key": config.secret_key,
        }
    )
