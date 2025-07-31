#  Copyright 2024 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""Module that defines the TableCustomSQLQueryParamsSetter class."""

from metadata.data_quality.validations.models import TableCustomSQLQueryRuntimeParameters
from metadata.data_quality.validations.runtime_param_setter.param_setter import (
    RuntimeParameterSetter,
)


class TableCustomSQLQueryParamsSetter(RuntimeParameterSetter):
    """Set runtime parameters for a the table custom sql query test."""

    def get_parameters(self, test_case) -> TableCustomSQLQueryRuntimeParameters:
        return TableCustomSQLQueryRuntimeParameters(
            conn_config=self.service_connection_config,
            entity=self.table_entity,
        )
