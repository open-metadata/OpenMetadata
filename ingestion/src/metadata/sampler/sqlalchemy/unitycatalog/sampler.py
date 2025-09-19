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

"""
Interfaces with database for all database engine
supporting sqlalchemy abstraction layer
"""


from metadata.generated.schema.entity.services.connections.database.databricksConnection import (
    DatabricksConnection,
)
from metadata.sampler.sqlalchemy.databricks.sampler import DatabricksSamplerInterface


class UnityCatalogSamplerInterface(DatabricksSamplerInterface):
    """
    Unity Catalog Sampler Interface
    """

    def __init__(self, *args, **kwargs):
        # Convert the service connection token to databricks connection auth
        service_connection_config = kwargs.get("service_connection_config")
        service_connection_config_dict = service_connection_config.model_dump()
        service_connection_config_dict["scheme"] = service_connection_config_dict[
            "scheme"
        ].value
        service_connection_config_dict["type"] = "Databricks"
        service_connection_config_dict["authType"] = {
            "token": service_connection_config_dict.pop("token")
        }
        kwargs["service_connection_config"] = DatabricksConnection.model_validate(
            service_connection_config_dict
        )

        super().__init__(*args, **kwargs)
