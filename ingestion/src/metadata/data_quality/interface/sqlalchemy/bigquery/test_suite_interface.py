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
"""Run BigQuery data-quality queries in the attached table's project."""

from metadata.data_quality.interface.sqlalchemy.sqa_test_suite_interface import SQATestSuiteInterface
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.ingestion.ometa.utils import model_str
from metadata.utils.profiler_utils import get_context_entities
from metadata.utils.ssl_manager import get_ssl_connection


class BigQueryTestSuiteInterface(SQATestSuiteInterface):
    """Keep violations and denominator queries in the same target project."""

    def create_session(self):
        if self.table_entity is None:
            raise ValueError("BigQuery table must resolve to a target database and schema before connecting")
        schema, database, _ = get_context_entities(entity=self.table_entity, metadata=self.ometa_client)
        if database is None or schema is None:
            raise ValueError("BigQuery table must resolve to a target database and schema before connecting")
        engine = get_ssl_connection(self.service_connection_config)
        schema_map = dict(engine.get_execution_options().get("schema_translate_map") or {})
        schema_name = model_str(schema.name)
        schema_map[schema_name] = f"{model_str(database.name)}.{schema_name}"
        self.session = create_and_bind_session(engine.execution_options(schema_translate_map=schema_map))
