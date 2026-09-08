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
"""MSSQL spec for data diff"""

from metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter import (
    BaseTableParameter,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.utils import fqn


class MssqlTableParameter(BaseTableParameter):
    """MSSQL data_diff parameter setter.

    The base get_data_diff_url obtains a connection dict from
    MssqlConnection.get_connection_dict, which carries the *service-level*
    database and no schema. data_diff needs the *table-specific* database and
    schema to resolve the table path of each side of the diff, and its MsSQL
    driver requires a schema outright.
    """

    def get_data_diff_url(
        self,
        db_service: DatabaseService,
        table_fqn: str,
        override_url: str | dict | None = None,
    ) -> str | dict:
        source_url = super().get_data_diff_url(db_service, table_fqn, override_url)
        if isinstance(source_url, dict):
            # Work on a copy to avoid mutating a dict that might be reused
            source_url = dict(source_url)
            _, database, schema, _ = fqn.split(table_fqn)
            source_url["database"] = database
            source_url["schema"] = schema
        return source_url
