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
Dispatch logic to map an Converter base based on dialect
"""
from collections import defaultdict

from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.profiler.orm.converter.bigquery.converter import BigqueryMapTypes
from metadata.profiler.orm.converter.common import CommonMapTypes
from metadata.profiler.orm.converter.redshift.converter import RedshiftMapTypes
from metadata.profiler.orm.converter.snowflake.converter import SnowflakeMapTypes

converter_registry = defaultdict(lambda: CommonMapTypes)
converter_registry[DatabaseServiceType.BigQuery] = BigqueryMapTypes
converter_registry[DatabaseServiceType.Snowflake] = SnowflakeMapTypes
converter_registry[DatabaseServiceType.Redshift] = RedshiftMapTypes
