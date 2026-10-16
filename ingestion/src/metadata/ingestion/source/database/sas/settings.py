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
"""SAS connector settings (OM_SAS_*)."""

from pydantic import Field
from pydantic_settings import SettingsConfigDict

from metadata.config.settings import OMSettings, om_settings


@om_settings
class SasSettings(OMSettings):
    """SAS connector settings (OM_SAS_*)."""

    model_config = SettingsConfigDict(env_prefix="OM_SAS_")

    verify_ssl: bool = Field(
        default=True,
        description=(
            "Verify TLS certificates when calling the SAS Information Catalog. "
            "Disable only for dev deployments with self-signed certs."
        ),
    )


sas_settings = SasSettings()
