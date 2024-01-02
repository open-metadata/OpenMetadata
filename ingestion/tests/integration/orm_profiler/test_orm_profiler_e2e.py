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
Test ORM Profiler workflow

To run this we need OpenMetadata server up and running.

No sample data is required beforehand
"""
import logging
from copy import deepcopy
from datetime import datetime, timedelta
from unittest import TestCase

from sqlalchemy import Column, DateTime, Integer, String, create_engine
from sqlalchemy.orm import declarative_base

from metadata.generated.schema.entity.data.table import (
    ColumnProfile,
    ProfileSampleType,
    Table,
)
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import (
    OpenMetadataConnection,
)
from metadata.generated.schema.entity.services.databaseService import DatabaseService
from metadata.generated.schema.security.client.openMetadataJWTClientConfig import (
    OpenMetadataJWTClientConfig,
)
from metadata.ingestion.connections.session import create_and_bind_session
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.utils.time_utils import (
    get_beginning_of_day_timestamp_mill,
    get_end_of_day_timestamp_mill,
)
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow
from metadata.workflow.workflow_output_handler import print_status

logging.basicConfig(level=logging.WARN)
logger = logging.getLogger(__name__)

sqlite_shared = "file:cachedb?mode=memory&cache=shared&check_same_thread=False"

ingestion_config = {
    "source": {
        "type": "sqlite",
        "serviceName": "test_sqlite",
        "serviceConnection": {
            "config": {
                "type": "SQLite",
                "databaseMode": sqlite_shared,
                "database": "main",
            }
        },
        "sourceConfig": {"config": {"type": "DatabaseMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}

Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    age = Column(Integer)
    signedup = Column(DateTime)


class NewUser(Base):
    __tablename__ = "new_users"
    id = Column(Integer, primary_key=True)
    name = Column(String(256))
    fullname = Column(String(256))
    nickname = Column(String(256))
    age = Column(Integer)
    signedup = Column(DateTime)


class ProfilerWorkflowTest(TestCase):
    """
    Run the end to end workflow and validate
    """

    engine = create_engine(
        f"sqlite+pysqlite:///{sqlite_shared}",
    )
    session = create_and_bind_session(engine)

    server_config = OpenMetadataConnection(
        hostPort="http://localhost:8585/api",
        authProvider="openmetadata",
        securityConfig=OpenMetadataJWTClientConfig(
            jwtToken="eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXBiEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fNr3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3ud-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
        ),
    )
    metadata = OpenMetadata(server_config)

    @classmethod
    def setUpClass(cls) -> None:
        """
        Prepare Ingredients
        """
        try:
            User.__table__.create(bind=cls.engine)
            NewUser.__table__.create(bind=cls.engine)
        except:
            logger.warning("Table Already exists")

        data = [
            User(
                name="John",
                fullname="John Doe",
                nickname="johnny b goode",
                age=30,
                signedup=datetime.now() - timedelta(days=10),
            ),
            User(
                name="Jane",
                fullname="Jone Doe",
                nickname=None,
                age=31,
                signedup=datetime.now() - timedelta(days=2),
            ),
            User(
                name="Joh",
                fullname="Joh Doe",
                nickname=None,
                age=37,
                signedup=datetime.now() - timedelta(days=1),
            ),
            User(
                name="Jae",
                fullname="Jae Doe",
                nickname=None,
                age=38,
                signedup=datetime.now() - timedelta(days=1),
            ),
        ]
        cls.session.add_all(data)
        cls.session.commit()

        new_user = [
            NewUser(
                name="John",
                fullname="John Doe",
                nickname="johnny b goode",
                age=30,
                signedup=datetime.now() - timedelta(days=10),
            ),
            NewUser(
                name="Jane",
                fullname="Jone Doe",
                nickname=None,
                age=31,
                signedup=datetime.now() - timedelta(days=2),
            ),
        ]
        cls.session.add_all(new_user)
        cls.session.commit()

        ingestion_workflow = MetadataWorkflow.create(ingestion_config)
        ingestion_workflow.execute()
        ingestion_workflow.raise_from_status()
        print_status(ingestion_workflow)
        ingestion_workflow.stop()

    @classmethod
    def tearDownClass(cls) -> None:
        """
        Clean up
        """

        service_id = str(
            cls.metadata.get_by_name(
                entity=DatabaseService, fqn="test_sqlite"
            ).id.__root__
        )

        cls.metadata.delete(
            entity=DatabaseService,
            entity_id=service_id,
            recursive=True,
            hard_delete=True,
        )

        User.__table__.drop(bind=cls.engine)
        NewUser.__table__.drop(bind=cls.engine)
        cls.session.close()

    def test_ingestion(self):
        """
        Validate that the ingestion ran correctly
        """

        table_entity: Table = self.metadata.get_by_name(
            entity=Table, fqn="test_sqlite.main.main.users"
        )
        assert table_entity.fullyQualifiedName.__root__ == "test_sqlite.main.main.users"

    def test_profiler_workflow(self):
        """
        Prepare and execute the profiler workflow
        on top of the Users table
        """
        workflow_config = deepcopy(ingestion_config)
        workflow_config["source"]["sourceConfig"]["config"].update(
            {
                "type": "Profiler",
                "tableFilterPattern": {"includes": ["users"]},
            }
        )
        workflow_config["processor"] = {
            "type": "orm-profiler",
            "config": {
                "profiler": {
                    "name": "my_profiler",
                    "timeout_seconds": 60,
                    "metrics": ["row_count", "min", "max", "COUNT", "null_count"],
                },
                "tableConfig": [
                    {
                        "fullyQualifiedName": "test_sqlite.main.main.users",
                        "profileSample": 75,
                    }
                ],
            },
        }

        profiler_workflow = ProfilerWorkflow.create(workflow_config)
        profiler_workflow.execute()
        status = profiler_workflow.result_status()
        profiler_workflow.stop()

        assert status == 0

        table = self.metadata.get_by_name(
            entity=Table,
            fqn="test_sqlite.main.main.users",
            fields=["tableProfilerConfig"],
        )

        profile = self.metadata.get_latest_table_profile(
            table.fullyQualifiedName
        ).profile

        assert not table.tableProfilerConfig
        assert profile.profileSample == 75.0
        assert profile.profileSampleType == ProfileSampleType.PERCENTAGE

        workflow_config["processor"]["config"]["tableConfig"][0][
            "profileSampleType"
        ] = ProfileSampleType.ROWS
        workflow_config["processor"]["config"]["tableConfig"][0]["profileSample"] = 3
        profiler_workflow = ProfilerWorkflow.create(workflow_config)
        profiler_workflow.execute()
        status = profiler_workflow.result_status()
        profiler_workflow.stop()

        assert status == 0

        table = self.metadata.get_by_name(
            entity=Table,
            fqn="test_sqlite.main.main.users",
            fields=["tableProfilerConfig"],
        )

        profile = self.metadata.get_latest_table_profile(
            table.fullyQualifiedName
        ).profile

        assert not table.tableProfilerConfig
        assert profile.profileSample == 3.0
        assert profile.rowCount == 4.0
        assert profile.profileSampleType == ProfileSampleType.ROWS

    def test_workflow_sample_profile(self):
        """Test the workflow sample profile gets propagated down to the table profileSample"""
        workflow_config = deepcopy(ingestion_config)
        workflow_config["source"]["sourceConfig"]["config"].update(
            {
                "type": "Profiler",
                "profileSample": 50,
                "tableFilterPattern": {"includes": ["new_users"]},
            }
        )
        workflow_config["processor"] = {"type": "orm-profiler", "config": {}}

        profiler_workflow = ProfilerWorkflow.create(workflow_config)
        profiler_workflow.execute()
        print_status(profiler_workflow)
        profiler_workflow.stop()

        table = self.metadata.get_by_name(
            entity=Table,
            fqn="test_sqlite.main.main.new_users",
            fields=["tableProfilerConfig"],
        )
        # setting sampleProfile from config has been temporarly removed
        # up until we split tests and profiling
        assert table.tableProfilerConfig is None

    def test_workflow_datetime_partition(self):
        """test workflow with partition"""
        workflow_config = deepcopy(ingestion_config)
        workflow_config["source"]["sourceConfig"]["config"].update(
            {
                "type": "Profiler",
                "tableFilterPattern": {"includes": ["users"]},
            }
        )
        workflow_config["processor"] = {
            "type": "orm-profiler",
            "config": {
                "profiler": {
                    "name": "my_profiler",
                    "timeout_seconds": 60,
                },
                "tableConfig": [
                    {
                        "fullyQualifiedName": "test_sqlite.main.main.users",
                        "profileSample": 100,
                        "partitionConfig": {
                            "enablePartitioning": "true",
                            "partitionColumnName": "signedup",
                            "partitionIntervalType": "TIME-UNIT",
                            "partitionIntervalUnit": "DAY",
                            "partitionInterval": 2,
                        },
                    }
                ],
            },
        }

        profiler_workflow = ProfilerWorkflow.create(workflow_config)
        profiler_workflow.execute()
        print_status(profiler_workflow)
        profiler_workflow.stop()

        table = self.metadata.get_by_name(
            entity=Table,
            fqn="test_sqlite.main.main.users",
            fields=["tableProfilerConfig"],
        )

        profile = self.metadata.get_latest_table_profile(
            table.fullyQualifiedName
        ).profile

        assert profile.rowCount == 4.0

        workflow_config["processor"] = {
            "type": "orm-profiler",
            "config": {
                "profiler": {
                    "name": "my_profiler",
                    "timeout_seconds": 60,
                },
                "tableConfig": [
                    {
                        "fullyQualifiedName": "test_sqlite.main.main.users",
                        "partitionConfig": {
                            "enablePartitioning": "true",
                            "partitionColumnName": "signedup",
                            "partitionIntervalType": "TIME-UNIT",
                            "partitionIntervalUnit": "DAY",
                            "partitionInterval": 2,
                        },
                    }
                ],
            },
        }

        profiler_workflow = ProfilerWorkflow.create(workflow_config)
        profiler_workflow.execute()
        print_status(profiler_workflow)
        profiler_workflow.stop()

        table = self.metadata.get_by_name(
            entity=Table,
            fqn="test_sqlite.main.main.users",
            fields=["tableProfilerConfig"],
        )

        profile = self.metadata.get_latest_table_profile(
            table.fullyQualifiedName
        ).profile

        assert profile.rowCount == 4.0

    def test_workflow_integer_range_partition(self):
        """test workflow with partition"""
        workflow_config = deepcopy(ingestion_config)
        workflow_config["source"]["sourceConfig"]["config"].update(
            {
                "type": "Profiler",
                "tableFilterPattern": {"includes": ["users"]},
            }
        )
        workflow_config["processor"] = {
            "type": "orm-profiler",
            "config": {
                "profiler": {
                    "name": "my_profiler",
                    "timeout_seconds": 60,
                },
                "tableConfig": [
                    {
                        "fullyQualifiedName": "test_sqlite.main.main.users",
                        "partitionConfig": {
                            "enablePartitioning": "true",
                            "partitionColumnName": "age",
                            "partitionIntervalType": "INTEGER-RANGE",
                            "partitionIntegerRangeStart": 37,
                            "partitionIntegerRangeEnd": 38,
                        },
                    }
                ],
            },
        }

        profiler_workflow = ProfilerWorkflow.create(workflow_config)
        profiler_workflow.execute()
        print_status(profiler_workflow)
        profiler_workflow.stop()

        table = self.metadata.get_by_name(
            entity=Table,
            fqn="test_sqlite.main.main.users",
            fields=["tableProfilerConfig"],
        )

        profile = self.metadata.get_latest_table_profile(
            table.fullyQualifiedName
        ).profile

        assert profile.rowCount == 4.0

        workflow_config["processor"] = {
            "type": "orm-profiler",
            "config": {
                "profiler": {
                    "name": "my_profiler",
                    "timeout_seconds": 60,
                },
                "tableConfig": [
                    {
                        "fullyQualifiedName": "test_sqlite.main.main.users",
                        "profileSample": 100,
                        "partitionConfig": {
                            "enablePartitioning": "true",
                            "partitionColumnName": "age",
                            "partitionIntervalType": "INTEGER-RANGE",
                            "partitionIntegerRangeStart": 37,
                            "partitionIntegerRangeEnd": 38,
                        },
                    }
                ],
            },
        }

        profiler_workflow = ProfilerWorkflow.create(workflow_config)
        profiler_workflow.execute()
        print_status(profiler_workflow)
        profiler_workflow.stop()

        table = self.metadata.get_by_name(
            entity=Table,
            fqn="test_sqlite.main.main.users",
            fields=["tableProfilerConfig"],
        )

        profile = self.metadata.get_latest_table_profile(
            table.fullyQualifiedName
        ).profile

        assert profile.rowCount == 4.0

    def test_workflow_values_partition(self):
        """test workflow with partition"""
        workflow_config = deepcopy(ingestion_config)
        workflow_config["source"]["sourceConfig"]["config"].update(
            {
                "type": "Profiler",
                "tableFilterPattern": {"includes": ["users"]},
            }
        )
        workflow_config["processor"] = {
            "type": "orm-profiler",
            "config": {
                "profiler": {
                    "name": "my_profiler",
                    "timeout_seconds": 60,
                },
                "tableConfig": [
                    {
                        "fullyQualifiedName": "test_sqlite.main.main.users",
                        "partitionConfig": {
                            "enablePartitioning": "true",
                            "partitionColumnName": "name",
                            "partitionIntervalType": "COLUMN-VALUE",
                            "partitionValues": ["John"],
                        },
                    }
                ],
            },
        }

        profiler_workflow = ProfilerWorkflow.create(workflow_config)
        profiler_workflow.execute()
        print_status(profiler_workflow)
        profiler_workflow.stop()

        table = self.metadata.get_by_name(
            entity=Table,
            fqn="test_sqlite.main.main.users",
            fields=["tableProfilerConfig"],
        )

        profile = self.metadata.get_latest_table_profile(
            table.fullyQualifiedName
        ).profile

        assert profile.rowCount == 4.0
        assert profile.profileSample is None

        workflow_config["processor"] = {
            "type": "orm-profiler",
            "config": {
                "profiler": {
                    "name": "my_profiler",
                    "timeout_seconds": 60,
                },
                "tableConfig": [
                    {
                        "fullyQualifiedName": "test_sqlite.main.main.users",
                        "profileSample": 100,
                        "partitionConfig": {
                            "enablePartitioning": "true",
                            "partitionColumnName": "name",
                            "partitionIntervalType": "COLUMN-VALUE",
                            "partitionValues": ["John"],
                        },
                    }
                ],
            },
        }

        profiler_workflow = ProfilerWorkflow.create(workflow_config)
        profiler_workflow.execute()
        print_status(profiler_workflow)
        profiler_workflow.stop()

        table = self.metadata.get_by_name(
            entity=Table,
            fqn="test_sqlite.main.main.users",
            fields=["tableProfilerConfig"],
        )

        profile = self.metadata.get_latest_table_profile(
            table.fullyQualifiedName
        ).profile

        assert profile.rowCount == 4.0

    def test_datalake_profiler_workflow_with_custom_profiler_config(self):
        """Test custom profiler config return expected sample and metric computation"""
        profiler_metrics = [
            "MIN",
            "MAX",
            "MEAN",
            "MEDIAN",
        ]
        id_metrics = ["MIN", "MAX"]
        non_metric_values = ["name", "timestamp"]

        workflow_config = deepcopy(ingestion_config)
        workflow_config["source"]["sourceConfig"]["config"].update(
            {
                "type": "Profiler",
            }
        )
        workflow_config["processor"] = {
            "type": "orm-profiler",
            "config": {
                "profiler": {
                    "name": "ingestion_profiler",
                    "metrics": profiler_metrics,
                },
                "tableConfig": [
                    {
                        "fullyQualifiedName": "test_sqlite.main.main.users",
                        "columnConfig": {
                            "includeColumns": [
                                {"columnName": "id", "metrics": id_metrics},
                                {"columnName": "age"},
                            ]
                        },
                    }
                ],
            },
        }

        profiler_workflow = ProfilerWorkflow.create(workflow_config)
        profiler_workflow.execute()
        status = profiler_workflow.result_status()
        profiler_workflow.stop()

        assert status == 0

        table = self.metadata.get_by_name(
            entity=Table,
            fqn="test_sqlite.main.main.users",
            fields=["tableProfilerConfig"],
        )

        id_profile = self.metadata.get_profile_data(
            "test_sqlite.main.main.users.id",
            get_beginning_of_day_timestamp_mill(),
            get_end_of_day_timestamp_mill(),
            profile_type=ColumnProfile,
        ).entities

        latest_id_profile = max(id_profile, key=lambda o: o.timestamp.__root__)

        id_metric_ln = 0
        for metric_name, metric in latest_id_profile:
            if metric_name.upper() in id_metrics:
                assert metric is not None
                id_metric_ln += 1
            else:
                assert metric is None if metric_name not in non_metric_values else True

        assert id_metric_ln == len(id_metrics)

        age_profile = self.metadata.get_profile_data(
            "test_sqlite.main.main.users.age",
            get_beginning_of_day_timestamp_mill(),
            get_end_of_day_timestamp_mill(),
            profile_type=ColumnProfile,
        ).entities

        latest_age_profile = max(age_profile, key=lambda o: o.timestamp.__root__)

        age_metric_ln = 0
        for metric_name, metric in latest_age_profile:
            if metric_name.upper() in profiler_metrics:
                assert metric is not None
                age_metric_ln += 1
            else:
                assert metric is None if metric_name not in non_metric_values else True

        assert age_metric_ln == len(profiler_metrics)

        latest_exc_timestamp = latest_age_profile.timestamp.__root__
        fullname_profile = self.metadata.get_profile_data(
            "test_sqlite.main.main.users.fullname",
            get_beginning_of_day_timestamp_mill(),
            get_end_of_day_timestamp_mill(),
            profile_type=ColumnProfile,
        ).entities

        assert not [
            p for p in fullname_profile if p.timestamp.__root__ == latest_exc_timestamp
        ]

        sample_data = self.metadata.get_sample_data(table)
        assert sorted([c.__root__ for c in sample_data.sampleData.columns]) == sorted(
            ["id", "age"]
        )

    def test_sample_data_ingestion(self):
        """test the rows of the sample data are what we expect"""
        workflow_config = deepcopy(ingestion_config)
        workflow_config["source"]["sourceConfig"]["config"].update(
            {
                "type": "Profiler",
                "tableFilterPattern": {"includes": ["users"]},
            }
        )
        workflow_config["processor"] = {
            "type": "orm-profiler",
            "config": {
                "profiler": {
                    "name": "my_profiler",
                    "timeout_seconds": 60,
                    "metrics": ["row_count", "min", "max", "COUNT", "null_count"],
                },
                "tableConfig": [
                    {
                        "fullyQualifiedName": "test_sqlite.main.main.users",
                    }
                ],
            },
        }

        profiler_workflow = ProfilerWorkflow.create(workflow_config)
        profiler_workflow.execute()
        status = profiler_workflow.result_status()
        profiler_workflow.stop()

        assert status == 0

        table = self.metadata.get_by_name(
            entity=Table,
            fqn="test_sqlite.main.main.users",
        )

        # Test we are getting the expected sample data
        expected_sample_data = [
            [
                1,
                "John",
                "John Doe",
                "johnny b goode",
                30,
            ],
            [
                2,
                "Jane",
                "Jone Doe",
                None,
                31,
            ],
            [
                3,
                "Joh",
                "Joh Doe",
                None,
                37,
            ],
            [
                4,
                "Jae",
                "Jae Doe",
                None,
                38,
            ],
        ]
        sample_data = self.metadata.get_sample_data(table).sampleData.rows
        sample_data = [data[:-1] for data in sample_data]  # remove timestamp as dynamic
        self.assertListEqual(
            sorted(sample_data),
            sorted(expected_sample_data),
        )
