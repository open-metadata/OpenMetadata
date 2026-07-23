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
"""Snowflake connector settings (OM_SNOWFLAKE_*)."""

from pydantic import Field
from pydantic_settings import SettingsConfigDict

from metadata.config.settings import OMSettings, om_settings


@om_settings
class SnowflakeSettings(OMSettings):
    """Snowflake connector settings (OM_SNOWFLAKE_*)."""

    model_config = SettingsConfigDict(env_prefix="OM_SNOWFLAKE_")

    schema_columns_cache_size: int = Field(
        default=2,
        ge=1,
        description=(
            "LRU cache size for per-schema column reflection; caps memory on "
            "pathologically wide schemas that can OOM small pods."
        ),
    )


snowflake_settings = SnowflakeSettings()
