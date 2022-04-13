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

from airflow.configuration import conf
from pydantic import BaseModel

from airflow_provider_openmetadata.lineage.config.commons import LINEAGE
from airflow_provider_openmetadata.lineage.config.providers import (
    InvalidAirflowProviderException,
    provider_config_registry,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    AuthProvider,
    OpenMetadataConnection,
)


class AirflowLineageConfig(BaseModel):
    airflow_service_name: str
    metadata_config: OpenMetadataConnection


def parse_airflow_config(airflow_service_name: str) -> AirflowLineageConfig:
    """
    Get airflow config from airflow.cfg and parse it
    to the config model
    """
    auth_provider_type = conf.get(
        LINEAGE, "auth_provider_type", fallback=AuthProvider.no_auth.value
    )

    if auth_provider_type == AuthProvider.no_auth.value:
        security_config = None
    else:
        load_security_config_fn = provider_config_registry.registry.get(
            auth_provider_type
        )
        if not load_security_config_fn:
            raise InvalidAirflowProviderException(
                f"Cannot find {auth_provider_type} in airflow providers registry."
            )
        security_config = load_security_config_fn()

    return AirflowLineageConfig(
        airflow_service_name=airflow_service_name,
        metadata_config=OpenMetadataConnection(
            hostPort=conf.get(
                LINEAGE,
                "openmetadata_api_endpoint",
                fallback="http://localhost:8585/api",
            ),
            authProvider=auth_provider_type,
            securityConfig=security_config,
        ),
    )


def get_lineage_config() -> AirflowLineageConfig:
    """
    Load the lineage config from airflow.cfg, from
    a JSON file path configures as env in OPENMETADATA_LINEAGE_CONFIG
    or return a default config.
    """
    airflow_service_name = conf.get(LINEAGE, "airflow_service_name", fallback=None)
    if airflow_service_name:
        return parse_airflow_config(airflow_service_name)

    openmetadata_config_file = os.getenv("OPENMETADATA_LINEAGE_CONFIG")

    # If config file, parse the JSON config, that should conform to AirflowLineageConfig
    if openmetadata_config_file:
        with open(openmetadata_config_file, encoding="utf-8") as config_file:
            config = json.load(config_file)
            return AirflowLineageConfig.parse_obj(config)

    # If nothing is configured, let's use a default for local
    return AirflowLineageConfig(
        airflow_service_name="airflow",
        metadata_config=OpenMetadataConnection(
            hostPort="http://localhost:8585/api",
        ),
    )
