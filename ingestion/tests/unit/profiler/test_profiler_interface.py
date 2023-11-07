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


from copy import deepcopy
from unittest import TestCase

from ingestion.build.lib.metadata.profiler.api.models import (
    ProfileSampleConfig,
    TableConfig,
)
from metadata.generated.schema.entity.data.database import (
    Database,
    DatabaseProfilerConfig,
)
from metadata.generated.schema.entity.data.databaseSchema import (
    DatabaseSchema,
    DatabaseSchemaProfilerConfig,
)
from metadata.generated.schema.entity.data.table import (
    ProfileSampleType,
    Table,
    TableProfilerConfig,
)
from metadata.generated.schema.entity.services.connections.connectionBasicType import (
    DataStorageConfig,
    SampleDataStorageConfig,
)
from metadata.generated.schema.metadataIngestion.databaseServiceProfilerPipeline import (
    DatabaseServiceProfilerPipeline,
)
from metadata.generated.schema.security.credentials.awsCredentials import AWSCredentials
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.profiler.interface.profiler_interface import ProfilerInterface


class ProfilerInterfaceTest(TestCase):
    """
    Profiler Interface tests cases
    """

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare Ingredients
        """
        cls.table = Table(
            id="ba451e8a-5069-4a45-ac38-95421bbdcb5a",
            name="demo_table",
            columns=[],
            tableProfilerConfig=TableProfilerConfig(
                sampleDataCount=101,
                profileSample=11,
                profileSampleType=ProfileSampleType.PERCENTAGE,
            ),
            service=EntityReference(
                id="ba451e8a-5069-4a45-ac38-95421bbdcb5a",
                name="demo_table",
                type="databaseService",
            ),
            database=EntityReference(
                id="ba451e8a-5069-4a45-ac38-95421bbdcb5a",
                name="demo_table",
                type="database",
            ),
        )

        cls.schema_storage_config = SampleDataStorageConfig(
            config=DataStorageConfig(
                bucketName="bucket-a",
                prefix="prefix-a",
                storageConfig=AWSCredentials(awsRegion="us-east-2"),
            )
        )

        cls.schema_profiler_config = DatabaseSchemaProfilerConfig(
            sampleDataCount=102,
            profileSample=12,
            sampleDataStorageConfig=cls.schema_storage_config,
        )

        cls.schema_entity = DatabaseSchema(
            id="ba451e8a-5069-4a45-ac38-95421bbdcb5a",
            name="demo_database",
            databaseSchemaProfilerConfig=cls.schema_profiler_config,
            service=EntityReference(
                id="ba451e8a-5069-4a45-ac38-95421bbdcb5a",
                name="demo_table",
                type="databaseService",
            ),
            database=EntityReference(
                id="ba451e8a-5069-4a45-ac38-95421bbdcb5a",
                name="demo_table",
                type="database",
            ),
        )

        cls.database_storage_config = SampleDataStorageConfig(
            config=DataStorageConfig(
                bucketName="bucket-b",
                prefix="prefix-b",
                storageConfig=AWSCredentials(awsRegion="us-east-1"),
            )
        )

        cls.database_profiler_config = DatabaseProfilerConfig(
            sampleDataCount=202,
            profileSample=22,
            sampleDataStorageConfig=cls.database_storage_config,
        )

        cls.database_entity = Database(
            id="ba451e8a-5069-4a45-ac38-95421bbdcb5a",
            name="demo_database",
            service=EntityReference(
                id="ba451e8a-5069-4a45-ac38-95421bbdcb5a",
                name="demo_table",
                type="databaseService",
            ),
            databaseProfilerConfig=cls.database_profiler_config,
        )

    def test_get_schema_profiler_config(self):
        self.assertIsNone(
            ProfilerInterface.get_schema_profiler_config(schema_entity=None)
        )
        schema_entity_copy = deepcopy(self.schema_entity)
        schema_entity_copy.databaseSchemaProfilerConfig = None
        self.assertIsNone(
            ProfilerInterface.get_schema_profiler_config(
                schema_entity=schema_entity_copy
            )
        )
        self.assertEqual(
            ProfilerInterface.get_schema_profiler_config(
                schema_entity=self.schema_entity
            ),
            self.schema_profiler_config,
        )

    def test_get_database_profiler_config(self):
        self.assertIsNone(
            ProfilerInterface.get_database_profiler_config(database_entity=None)
        )
        database_entity_copy = deepcopy(self.database_entity)
        database_entity_copy.databaseProfilerConfig = None
        self.assertIsNone(
            ProfilerInterface.get_database_profiler_config(
                database_entity=database_entity_copy
            )
        )
        self.assertEqual(
            ProfilerInterface.get_database_profiler_config(
                database_entity=self.database_entity
            ),
            self.database_profiler_config,
        )

    def test_get_storage_config_for_table(self):
        source_config = DatabaseServiceProfilerPipeline()

        expected = ProfileSampleConfig(
            profile_sample=11,
            profile_sample_type=ProfileSampleType.PERCENTAGE,
        )
        actual = ProfilerInterface.get_profile_sample_config(
            entity=self.table,
            schema_profiler_config=self.schema_profiler_config,
            database_profiler_config=self.database_profiler_config,
            entity_config=None,
            source_config=source_config,
        )
        self.assertEqual(expected, actual)

        profiler = TableConfig(
            profileSample=11,
            profileSampleType=ProfileSampleType.PERCENTAGE,
            fullyQualifiedName="demo",
        )
        expected = ProfileSampleConfig(
            profile_sample=11,
            profile_sample_type=ProfileSampleType.PERCENTAGE,
        )
        actual = ProfilerInterface.get_profile_sample_config(
            entity=self.table,
            schema_profiler_config=self.schema_profiler_config,
            database_profiler_config=self.database_profiler_config,
            entity_config=profiler,
            source_config=source_config,
        )
        self.assertEqual(expected, actual)

        profiler = None
        expected = ProfileSampleConfig(
            profile_sample=22,
            profile_sample_type=ProfileSampleType.PERCENTAGE,
        )
        actual = ProfilerInterface.get_profile_sample_config(
            entity=None,
            schema_profiler_config=None,
            database_profiler_config=self.database_profiler_config,
            entity_config=profiler,
            source_config=source_config,
        )
        self.assertEqual(expected, actual)

    def test_get_sample_data_count_config(self):
        entity_config = TableConfig(
            profileSample=20,
            profileSampleType=ProfileSampleType.PERCENTAGE,
            sampleDataCount=20,
            fullyQualifiedName="demo",
        )
        source_config = DatabaseServiceProfilerPipeline()

        actual = ProfilerInterface.get_sample_data_count_config(
            entity=self.table,
            schema_profiler_config=self.schema_profiler_config,
            database_profiler_config=self.database_profiler_config,
            entity_config=entity_config,
            source_config=source_config,
        )
        self.assertEqual(20, actual)

        actual = ProfilerInterface.get_sample_data_count_config(
            entity=self.table,
            schema_profiler_config=self.schema_profiler_config,
            database_profiler_config=self.database_profiler_config,
            entity_config=None,
            source_config=source_config,
        )
        self.assertEqual(101, actual)

        table_copy = deepcopy(self.table)
        table_copy.tableProfilerConfig = None

        actual = ProfilerInterface.get_sample_data_count_config(
            entity=table_copy,
            schema_profiler_config=self.schema_profiler_config,
            database_profiler_config=self.database_profiler_config,
            entity_config=None,
            source_config=source_config,
        )
        self.assertEqual(102, actual)

        actual = ProfilerInterface.get_sample_data_count_config(
            entity=table_copy,
            schema_profiler_config=None,
            database_profiler_config=self.database_profiler_config,
            entity_config=None,
            source_config=source_config,
        )
        self.assertEqual(202, actual)

        actual = ProfilerInterface.get_sample_data_count_config(
            entity=table_copy,
            schema_profiler_config=None,
            database_profiler_config=None,
            entity_config=None,
            source_config=source_config,
        )
        self.assertEqual(50, actual)
