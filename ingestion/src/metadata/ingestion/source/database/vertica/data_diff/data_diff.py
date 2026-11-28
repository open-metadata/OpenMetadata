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
"""Vertica spec for data diff."""

from metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter import (
    BaseTableParameter,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.utils import fqn


class VerticaTableParameter(BaseTableParameter):
    """Vertica data_diff parameter setter.

    VerticaConnection.database is optional at the service level, so
    VerticaConnection.get_connection_dict may omit or hold a different database
    than the compared table. Stamp the table's database onto a fresh copy so
    multi-database diffs under one service stay isolated.
    """

    def get_data_diff_url(
        self,
        db_service: DatabaseService,
        table_fqn: str,
        override_url: str | dict | None = None,
    ) -> str | dict:
        source_url = super().get_data_diff_url(db_service, table_fqn, override_url)
        if isinstance(source_url, dict):
            source_url = dict(source_url)
            _, database, _, _ = fqn.split(table_fqn)
            source_url["database"] = database
        return source_url
