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

"""
Test the SQL profiler using a Postgres and a MySQL container.
We load a simple user table in each service and run the profiler on it.
To run this we need OpenMetadata server up and running.
No sample data is required beforehand
"""

import json
import time
from typing import List
from unittest import TestCase, TestLoader

from _openmetadata_testutils.ometa import int_admin_ometa
from metadata.generated.schema.configuration.profilerConfiguration import (
    MetricConfigurationDefinition,
    MetricType,
    ProfilerConfiguration,
)
from metadata.generated.schema.entity.data.table import DataType, Table
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.settings.settings import Settings, SettingType
from metadata.generated.schema.type.entityProfile import EntityProfile, ProfileTypeEnum
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow

from ...utils.docker_service_builders.test_container_builder import ContainerBuilder
from ..integration_base import (
    METADATA_INGESTION_CONFIG_TEMPLATE,
    PROFILER_INGESTION_CONFIG_TEMPLATE,
)

TestLoader.sortTestMethodsUsing = None  # type: ignore


class TestSQAProfiler(TestCase):
    @classmethod
    def setUpClass(cls):
        cls.metadata = int_admin_ometa()
        cls.container_builder = ContainerBuilder()
        try:
            cls.container_builder.run_postgres_container()
            cls.container_builder.run_mysql_container()

            for container in cls.container_builder.containers:
                container_config = container.get_config()
                source_config = container.get_source_config()
                config = METADATA_INGESTION_CONFIG_TEMPLATE.format(
                    type=container.connector_type,
                    service_name=type(container).__name__,
                    service_config=container_config,
                    source_config=source_config,
                )
                ingestion_workflow = MetadataWorkflow.create(
                    json.loads(config),
                )
                ingestion_workflow.execute()
                ingestion_workflow.raise_from_status()
                ingestion_workflow.stop()
        except Exception as e:
            cls.container_builder.stop_all_containers()
            raise e

    @classmethod
    def tearDownClass(cls):
        cls.container_builder.stop_all_containers()
        db_entities = []
        for container in cls.container_builder.containers:
            db_entities.append(
                cls.metadata.get_by_name(DatabaseService, type(container).__name__)
            )
        for db_entity in db_entities:
            cls.metadata.delete(DatabaseService, db_entity.id, True, True)
        cls._clean_up_settings()

    @classmethod
    def _clean_up_settings(cls):
        """Reset profiler settings"""
        profiler_configuration = ProfilerConfiguration(metricConfiguration=[])

        settings = Settings(
            config_type=SettingType.profilerConfiguration,
            config_value=profiler_configuration,
        )
        cls.metadata.create_or_update_settings(settings)

    def test_profiler_workflow(self):
        """test a simple profiler workflow on a table in each service and validate the profile is created"""
        for container in self.container_builder.containers:
            try:
                config = PROFILER_INGESTION_CONFIG_TEMPLATE.format(
                    type=container.connector_type,
                    service_config=container.get_config(),
                    service_name=type(container).__name__,
                )
                profiler_workflow = ProfilerWorkflow.create(
                    json.loads(config),
                )
                profiler_workflow.execute()
                profiler_workflow.print_status()
                profiler_workflow.raise_from_status()
                profiler_workflow.stop()
            except Exception as e:
                self.fail(
                    f"Profiler workflow failed for {type(container).__name__} with error {e}"
                )

        tables: List[Table] = []
        for container in self.container_builder.containers:
            service_name = type(container).__name__
            cfg = json.loads(container.get_config())
            db_name = cfg.get("database") or cfg.get("databaseSchema", "default")
            tables.extend(
                self.metadata.list_all_entities(
                    Table, params={"database": f"{service_name}.{db_name}"}
                )
            )
        for table in tables:
            if table.name.root != "users":
                continue
            table = self.metadata.get_latest_table_profile(table.fullyQualifiedName)
            columns = table.columns
            self.assertIsNotNone(table.profile)
            for column in columns:
                self.assertIsNotNone(column.profile)

    def test_profiler_workflow_w_globale_config(self):
        """test a simple profiler workflow with a globale profiler configuration"""
        # add metric level settings
        profiler_configuration = ProfilerConfiguration(
            metricConfiguration=[
                MetricConfigurationDefinition(
                    dataType=DataType.INT,
                    disabled=False,
                    metrics=[MetricType.valuesCount, MetricType.distinctCount],
                ),
                MetricConfigurationDefinition(
                    dataType=DataType.VARCHAR, disabled=True, metrics=None
                ),
            ]
        )

        settings = Settings(
            config_type=SettingType.profilerConfiguration,
            config_value=profiler_configuration,
        )
        self.metadata.create_or_update_settings(settings)

        service_names = []

        for container in self.container_builder.containers:
            try:
                service_name = type(container).__name__
                service_names.append(service_name)
                config = PROFILER_INGESTION_CONFIG_TEMPLATE.format(
                    type=container.connector_type,
                    service_config=container.get_config(),
                    service_name=service_name,
                )
                profiler_workflow = ProfilerWorkflow.create(
                    json.loads(config),
                )
                profiler_workflow.execute()
                profiler_workflow.print_status()
                profiler_workflow.raise_from_status()
                profiler_workflow.stop()
            except Exception as e:
                self.fail(f"Profiler workflow failed for {service_name} with error {e}")

        tables: List[Table] = []
        for container in self.container_builder.containers:
            sn = type(container).__name__
            cfg = json.loads(container.get_config())
            db_name = cfg.get("database") or cfg.get("databaseSchema", "default")
            tables.extend(
                self.metadata.list_all_entities(
                    Table, params={"database": f"{sn}.{db_name}"}
                )
            )
        for table in tables:
            if table.name.root != "users":
                continue
            table = self.metadata.get_latest_table_profile(table.fullyQualifiedName)
            columns = table.columns
            self.assertIsNotNone(table.profile)
            for column in columns:
                if column.dataType == DataType.INT:
                    self.assertIsNone(column.profile.mean)
                    self.assertIsNotNone(column.profile.valuesCount)
                    self.assertIsNotNone(column.profile.distinctCount)
                if column.dataType == DataType.STRING:
                    self.assertIsNone(column.profile.mean)
                    self.assertIsNone(column.profile.valuesCount)
                    self.assertIsNone(column.profile.distinctCount)

    def test_list_entity_profiles(self):
        """fetch recent profiles via API and ensure we receive entity profiles"""
        # Use a 24h window ending now
        end_ts = int(time.time() * 1000)
        start_ts = end_ts - 24 * 60 * 60 * 1000

        get_profiles = getattr(self.metadata, "get_profile_data_by_type")
        profiles_all = get_profiles(Table, start_ts, end_ts)

        self.assertTrue(hasattr(profiles_all, "total"))
        self.assertTrue(hasattr(profiles_all, "entities"))

        if profiles_all.entities:
            first = profiles_all.entities[0]
            self.assertIsInstance(first, EntityProfile)
            self.assertIsNotNone(first.id)
            self.assertIsNotNone(first.entityReference)
            self.assertIsNotNone(first.timestamp)
            self.assertIsNotNone(first.profileData)

        profiles_table = get_profiles(Table, start_ts, end_ts, ProfileTypeEnum.table)
        self.assertGreater(len(profiles_table.entities), 0)
        types = {ep.profileType for ep in profiles_table.entities}
        self.assertEqual(types, {ProfileTypeEnum.table})
