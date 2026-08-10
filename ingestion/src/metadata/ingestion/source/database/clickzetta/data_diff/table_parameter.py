#  Copyright 2026 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
"""OpenMetadata runtime-parameter adapter for ClickZetta table diff."""

from metadata.data_quality.validations.runtime_param_setter.base_diff_params_setter import (
    BaseTableParameter,
)
from metadata.ingestion.source.database.clickzetta.data_diff.data_diff import (
    register_clickzetta_data_diff,
)

# Register only when OpenMetadata explicitly imports this data-diff parameter
# class through a service spec.  Merely installing the connector has no effect.
register_clickzetta_data_diff()


class ClickzettaTableParameter(BaseTableParameter):
    """Use the shared OpenMetadata table-parameter construction."""
