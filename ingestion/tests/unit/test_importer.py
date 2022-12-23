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
Test import utilities
"""
from unittest import TestCase

from metadata.generated.schema.entity.services.serviceType import ServiceType
from metadata.utils.importer import (
    get_class_name,
    get_module_name,
    import_bulk_sink_type,
    import_class,
    import_processor_class,
    import_sink_class,
    import_source_class,
    import_stage_class,
)


# pylint: disable=import-outside-toplevel
class ImporterTest(TestCase):
    """
    Validate that we properly convert
    module paths and load classes.
    """

    def test_get_module_name(self) -> None:
        self.assertEqual(get_module_name("mysql"), "mysql")
        self.assertEqual(get_module_name("redshift-usage"), "redshift_usage")

    def test_get_class_name(self) -> None:
        self.assertEqual(get_class_name("mysql"), "Mysql")
        self.assertEqual(get_class_name("redshift-usage"), "RedshiftUsage")

    def test_import_class(self) -> None:
        from metadata.ingestion.source.database.mysql import (
            MysqlSource,  # pylint: disable=import-outside-toplevel
        )

        self.assertEqual(
            import_class("metadata.ingestion.source.database.mysql.MysqlSource"),
            MysqlSource,
        )

    def test_import_source_class(self) -> None:
        from metadata.ingestion.source.database.mysql import MysqlSource
        from metadata.ingestion.source.database.snowflake import SnowflakeSource

        self.assertEqual(
            import_source_class(service_type=ServiceType.Database, source_type="mysql"),
            MysqlSource,
        )

        self.assertEqual(
            import_source_class(
                service_type=ServiceType.Database, source_type="snowflake"
            ),
            SnowflakeSource,
        )

    def test_import_processor_class(self) -> None:
        from metadata.ingestion.processor.query_parser import QueryParserProcessor

        self.assertEqual(
            import_processor_class(processor_type="query-parser"),
            QueryParserProcessor,
        )

    def test_import_stage_class(self) -> None:

        from metadata.ingestion.stage.table_usage import TableUsageStage

        self.assertEqual(import_stage_class(stage_type="table-usage"), TableUsageStage)

    def test_import_sink_class(self) -> None:

        from metadata.ingestion.sink.metadata_rest import MetadataRestSink

        self.assertEqual(import_sink_class(sink_type="metadata-rest"), MetadataRestSink)

    def test_import_bulk_sink_type(self) -> None:

        from metadata.ingestion.bulksink.metadata_usage import MetadataUsageBulkSink

        self.assertEqual(
            import_bulk_sink_type(bulk_sink_type="metadata-usage"),
            MetadataUsageBulkSink,
        )

    def test_import_sink_from(self) -> None:
        from metadata.orm_profiler.sink.metadata_rest import MetadataRestSink

        self.assertEqual(
            import_sink_class(sink_type="metadata-rest", from_="orm_profiler"),
            MetadataRestSink,
        )
