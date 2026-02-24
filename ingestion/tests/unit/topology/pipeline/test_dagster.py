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
"""
Test Dagster using the topology
"""
import json
from pathlib import Path
from unittest import TestCase
from unittest.mock import patch

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import (
    Pipeline,
    PipelineStatus,
    StatusType,
    Task,
    TaskStatus,
)
from metadata.generated.schema.entity.data.table import Table
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import FullyQualifiedEntityName, SourceUrl
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import (
    LabelType,
    State,
    TagLabel,
    TagSource,
)
from metadata.ingestion.models.pipeline_status import OMetaPipelineStatus
from metadata.ingestion.source.pipeline.dagster.metadata import DagsterSource
from metadata.ingestion.source.pipeline.dagster.models import (
    AssetDependency,
    AssetKey,
    AssetMaterialization,
    DagsterAssetNode,
    DagsterAssetReference,
    GraphOrError,
    JobReference,
    MetadataEntry,
    TableResolutionResult,
)

mock_file_path = (
    Path(__file__).parent.parent.parent / "resources/datasets/dagster_dataset.json"
)
with open(mock_file_path, encoding="UTF-8") as file:
    mock_data: dict = json.load(file)

mock_dagster_config = {
    "source": {
        "type": "dagster",
        "serviceName": "dagster_source",
        "serviceConnection": {
            "config": {"type": "Dagster", "host": "http://lolhost:3000"}
        },
        "sourceConfig": {"config": {"type": "PipelineMetadata"}},
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {"jwtToken": "jnsdjonfonsodifnoisdnfoinsdonfonsd"},
        }
    },
}


EXPECTED_DAGSTER_DETAILS = mock_data["data"]["graphOrError"]

EXPECTED_CREATED_PIPELINES = [
    CreatePipelineRequest(
        name="graph5164c131c3524a271e7ecce49766d50a479b5ff4",
        displayName="story_recommender_job",
        description=None,
        concurrency=None,
        pipelineLocation=None,
        startDate=None,
        tasks=[
            Task(
                name="s3__recommender__recommender_model",
                displayName="s3__recommender__recommender_model",
                fullyQualifiedName=None,
                description=None,
                downstreamTasks=["s3__recommender__user_story_matrix"],
                taskType=None,
                taskSQL=None,
                startDate=None,
                endDate=None,
                tags=[],
                sourceUrl=SourceUrl(
                    "http://lolhost:3000/locations/project_fully_featured/jobs/story_recommender_job/s3__recommender__recommender_model"
                ),
            ),
            Task(
                name="s3__recommender__user_story_matrix",
                displayName="s3__recommender__user_story_matrix",
                fullyQualifiedName=None,
                description=None,
                downstreamTasks=["snowflake__recommender__comment_stories"],
                taskType=None,
                taskSQL=None,
                startDate=None,
                endDate=None,
                tags=[],
                sourceUrl=SourceUrl(
                    "http://lolhost:3000/locations/project_fully_featured/jobs/story_recommender_job/s3__recommender__user_story_matrix"
                ),
            ),
            Task(
                name="snowflake__recommender__comment_stories",
                displayName="snowflake__recommender__comment_stories",
                fullyQualifiedName=None,
                description=None,
                downstreamTasks=None,
                taskType=None,
                taskSQL=None,
                startDate=None,
                endDate=None,
                tags=[],
                sourceUrl=SourceUrl(
                    "http://lolhost:3000/locations/project_fully_featured/jobs/story_recommender_job/snowflake__recommender__comment_stories"
                ),
            ),
            Task(
                name="snowflake__recommender__component_top_stories",
                displayName="snowflake__recommender__component_top_stories",
                fullyQualifiedName=None,
                description=None,
                downstreamTasks=[
                    "s3__recommender__recommender_model",
                    "s3__recommender__user_story_matrix",
                ],
                taskType=None,
                taskSQL=None,
                startDate=None,
                endDate=None,
                tags=[],
                sourceUrl=SourceUrl(
                    "http://lolhost:3000/locations/project_fully_featured/jobs/story_recommender_job/snowflake__recommender__component_top_stories"
                ),
            ),
            Task(
                name="snowflake__recommender__user_top_recommended_stories",
                displayName="snowflake__recommender__user_top_recommended_stories",
                fullyQualifiedName=None,
                description=None,
                downstreamTasks=[
                    "s3__recommender__recommender_model",
                    "s3__recommender__user_story_matrix",
                ],
                taskType=None,
                taskSQL=None,
                startDate=None,
                endDate=None,
                tags=[],
                sourceUrl=SourceUrl(
                    "http://lolhost:3000/locations/project_fully_featured/jobs/story_recommender_job/snowflake__recommender__user_top_recommended_stories"
                ),
            ),
        ],
        tags=[
            TagLabel(
                tagFQN="DagsterTags.hacker_new_repository",
                description=None,
                source="Classification",
                labelType="Automated",
                state="Suggested",
                href=None,
            )
        ],
        owners=None,
        service="dagster_source_test",
        extension=None,
        sourceUrl=SourceUrl(
            "http://lolhost:3000/locations/project_fully_featured/jobs/story_recommender_job/"
        ),
    ),
]
MOCK_CONNECTION_URI_PATH = (
    "/workspace/__repository__do_it_all_with_default_config"
    "@cereal.py/jobs/do_it_all_with_default_config/"
)
MOCK_LOG_URL = (
    "http://localhost:8080/instance/runs/a6ebb16c-505f-446d-8642-171c3320ccef"
)

EXPTECTED_PIPELINE_NAME = ["story_recommender_job"]

EXPECTED_PIPELINE_STATUS = [
    OMetaPipelineStatus(
        pipeline_fqn="dagster_source.a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
        pipeline_status=PipelineStatus(
            executionStatus=StatusType.Pending.value,
            taskStatus=[
                TaskStatus(
                    name="a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
                    executionStatus=StatusType.Pending.value,
                    startTime=1659616627124,
                    endTime=1659616635858,
                    logLink=f"{MOCK_LOG_URL}/status",
                )
            ],
            timestamp=1659616635858,
        ),
    ),
    OMetaPipelineStatus(
        pipeline_fqn="dagster_source.a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
        pipeline_status=PipelineStatus(
            executionStatus=StatusType.Successful.value,
            taskStatus=[
                TaskStatus(
                    name="a10f6d82-4fc6-4c90-ba04-bb773c8fbb0f",
                    executionStatus=StatusType.Successful.value,
                    startTime=1655393914000,
                    endTime=1655394054000,
                    logLink=f"{MOCK_LOG_URL}/status",
                )
            ],
            timestamp=1655393914000,
        ),
    ),
]

MOCK_PIPELINE_SERVICE = PipelineService(
    id="86ff3c40-7c51-4ff5-9727-738cead28d9a",
    name="dagster_source_test",
    fullyQualifiedName=FullyQualifiedEntityName("dagster_source_test"),
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.Dagster,
)


MOCK_PIPELINE = Pipeline(
    id="a58b1856-729c-493b-bc87-6d2269b43ec0",
    name="do_it_all_with_default_config",
    fullyQualifiedName="dagster_source.do_it_all_with_default_config",
    displayName="do_it_all_with_default_config",
    description="",
    sourceUrl=MOCK_CONNECTION_URI_PATH,
    tasks=[
        Task(
            name="a58b1856-729c-493b-bc87-6d2269b43ec0",
            displayName="do_it_all_with_default_config",
        )
    ],
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
)


class DagsterUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    Dagster Pipeline Unit Test
    """

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    @patch("dagster_graphql.DagsterGraphQLClient")
    # @patch("metadata.ingestion.source.pipeline.dagster.get_tag_labels")
    def __init__(self, methodName, graphql_client, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        graphql_client.return_value = False
        config = OpenMetadataWorkflowConfig.model_validate(mock_dagster_config)
        self.dagster = DagsterSource.create(
            mock_dagster_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.dagster.context.get().__dict__["pipeline"] = MOCK_PIPELINE.name.root
        self.dagster.context.get().__dict__[
            "pipeline_service"
        ] = MOCK_PIPELINE_SERVICE.name.root
        self.dagster.context.get().__dict__["repository_name"] = "hacker_new_repository"
        self.dagster.context.get().__dict__[
            "repository_location"
        ] = "project_fully_featured"

    def test_pipeline_name(self):
        assert (
            self.dagster.get_pipeline_name(GraphOrError(**EXPECTED_DAGSTER_DETAILS))
            in EXPTECTED_PIPELINE_NAME
        )

    @patch("metadata.ingestion.source.pipeline.dagster.client.DagsterClient.get_jobs")
    @patch("metadata.utils.tag_utils.get_tag_label")
    def test_yield_pipeline(self, get_tag_label, get_jobs):
        results = self.dagster.yield_pipeline(GraphOrError(**EXPECTED_DAGSTER_DETAILS))
        get_jobs.return_value = GraphOrError(**EXPECTED_DAGSTER_DETAILS)
        get_tag_label.return_value = TagLabel(
            tagFQN="DagsterTags.hacker_new_repository",
            labelType=LabelType.Automated.value,
            state=State.Suggested.value,
            source=TagSource.Classification.value,
        )
        pipelines_list = []
        for result in results:
            pipelines_list.append(result.right)

        for _, (expected, original) in enumerate(
            zip(EXPECTED_CREATED_PIPELINES, pipelines_list)
        ):
            self.assertEqual(expected, original)


class TestAssetKey(TestCase):
    """Test AssetKey model and its to_string method"""

    def test_to_string_three_parts(self):
        """Test asset key with database.schema.table format"""
        asset_key = AssetKey(path=["my_database", "my_schema", "my_table"])
        self.assertEqual(asset_key.to_string(), "my_database.my_schema.my_table")

    def test_to_string_two_parts(self):
        """Test asset key with schema.table format"""
        asset_key = AssetKey(path=["my_schema", "my_table"])
        self.assertEqual(asset_key.to_string(), "my_schema.my_table")

    def test_to_string_single_part(self):
        """Test asset key with single table name"""
        asset_key = AssetKey(path=["my_table"])
        self.assertEqual(asset_key.to_string(), "my_table")


class TestAssetKeyNormalization(TestCase):
    """Test AssetKey normalization with prefix stripping"""

    def test_normalize_no_strip(self):
        """Test normalization with strip_prefix=0 returns same key"""
        asset_key = AssetKey(path=["project", "env", "schema", "table"])
        normalized = asset_key.normalize(strip_prefix=0)
        assert normalized.path == ["project", "env", "schema", "table"]

    def test_normalize_strip_two_segments(self):
        """Test stripping first 2 segments"""
        asset_key = AssetKey(path=["project", "env", "schema", "table"])
        normalized = asset_key.normalize(strip_prefix=2)
        assert normalized.path == ["schema", "table"]
        assert normalized.to_string() == "schema.table"

    def test_normalize_strip_one_segment(self):
        """Test stripping first segment"""
        asset_key = AssetKey(path=["project", "db", "schema", "table"])
        normalized = asset_key.normalize(strip_prefix=1)
        assert normalized.path == ["db", "schema", "table"]

    def test_normalize_strip_more_than_length(self):
        """Test stripping more segments than available returns original"""
        asset_key = AssetKey(path=["schema", "table"])
        normalized = asset_key.normalize(strip_prefix=5)
        assert normalized.path == ["schema", "table"]

    def test_normalize_negative_strip(self):
        """Test negative strip_prefix returns original"""
        asset_key = AssetKey(path=["schema", "table"])
        normalized = asset_key.normalize(strip_prefix=-1)
        assert normalized.path == ["schema", "table"]


class TestTableResolutionResult(TestCase):
    """Test TableResolutionResult model"""

    def test_is_resolved_with_table(self):
        """Test is_resolved returns True when table_entity is present"""
        mock_table = Table(
            id="a58b1856-729c-493b-bc87-6d2269b43ec0",
            name="test_table",
            columns=[],
            databaseSchema=EntityReference(
                id="85811038-099a-11ed-861d-0242ac120002", type="databaseSchema"
            ),
        )
        result = TableResolutionResult(
            table_fqn="service.db.schema.table", table_entity=mock_table
        )
        self.assertTrue(result.is_resolved)

    def test_is_resolved_without_table(self):
        """Test is_resolved returns False when table_entity is None"""
        result = TableResolutionResult()
        self.assertFalse(result.is_resolved)

    def test_is_resolved_with_fqn_only(self):
        """Test is_resolved returns False when only fqn is set but entity is None"""
        result = TableResolutionResult(table_fqn="service.db.schema.table")
        self.assertFalse(result.is_resolved)


class TestDagsterAssetModels(TestCase):
    """Test Dagster asset-related models"""

    def test_dagster_asset_node_basic(self):
        """Test basic DagsterAssetNode creation"""
        asset = DagsterAssetNode(
            id="asset-123",
            assetKey=AssetKey(path=["db", "schema", "table"]),
            description="Test asset",
            computeKind="python",
        )
        self.assertEqual(asset.id, "asset-123")
        self.assertEqual(asset.assetKey.to_string(), "db.schema.table")
        self.assertEqual(asset.description, "Test asset")
        self.assertEqual(asset.computeKind, "python")

    def test_dagster_asset_node_with_dependencies(self):
        """Test DagsterAssetNode with dependencies"""
        upstream_ref = DagsterAssetReference(
            assetKey=AssetKey(path=["source_db", "source_schema", "source_table"])
        )
        asset = DagsterAssetNode(
            id="asset-456",
            assetKey=AssetKey(path=["target_db", "target_schema", "target_table"]),
            dependencies=[AssetDependency(asset=upstream_ref)],
        )
        self.assertIsNotNone(asset.dependencies)
        self.assertEqual(len(asset.dependencies), 1)
        first_dep = asset.dependencies[0]
        self.assertIsNotNone(first_dep.asset)
        self.assertEqual(
            first_dep.asset.assetKey.to_string(),
            "source_db.source_schema.source_table",
        )

    def test_dagster_asset_node_with_jobs(self):
        """Test DagsterAssetNode with job references"""
        asset = DagsterAssetNode(
            id="asset-789",
            assetKey=AssetKey(path=["my_table"]),
            jobs=[
                JobReference(name="daily_job", id="job-1"),
                JobReference(name="hourly_job", id="job-2"),
            ],
        )
        self.assertIsNotNone(asset.jobs)
        self.assertEqual(len(asset.jobs), 2)
        self.assertEqual(asset.jobs[0].name, "daily_job")
        self.assertEqual(asset.jobs[1].name, "hourly_job")

    def test_metadata_entry_with_alias(self):
        """Test MetadataEntry with __typename alias"""
        entry = MetadataEntry(
            **{"__typename": "TextMetadataEntry", "label": "database", "text": "my_db"}
        )
        self.assertEqual(entry.typename, "TextMetadataEntry")
        self.assertEqual(entry.label, "database")
        self.assertEqual(entry.text, "my_db")

    def test_asset_materialization(self):
        """Test AssetMaterialization model"""
        materialization = AssetMaterialization(
            runId="run-123",
            timestamp=1699999999.0,
            metadataEntries=[
                MetadataEntry(
                    **{
                        "__typename": "TextMetadataEntry",
                        "label": "database",
                        "text": "prod_db",
                    }
                ),
                MetadataEntry(
                    **{
                        "__typename": "TextMetadataEntry",
                        "label": "schema",
                        "text": "public",
                    }
                ),
            ],
        )
        self.assertEqual(materialization.runId, "run-123")
        self.assertEqual(len(materialization.metadataEntries), 2)


class TestDagsterLineageHelpers(TestCase):
    """Test Dagster lineage helper methods"""

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    @patch("dagster_graphql.DagsterGraphQLClient")
    def setUp(self, graphql_client, test_connection):
        test_connection.return_value = False
        graphql_client.return_value = False
        config = OpenMetadataWorkflowConfig.model_validate(mock_dagster_config)
        self.dagster = DagsterSource.create(
            mock_dagster_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.dagster.context.get().__dict__["pipeline"] = MOCK_PIPELINE.name.root
        self.dagster.context.get().__dict__[
            "pipeline_service"
        ] = MOCK_PIPELINE_SERVICE.name.root
        self.dagster.context.get().__dict__["repository_name"] = "hacker_new_repository"
        self.dagster.context.get().__dict__[
            "repository_location"
        ] = "project_fully_featured"

    def test_is_asset_in_pipeline_true(self):
        """Test _is_asset_in_pipeline returns True when asset has matching job"""
        asset = DagsterAssetNode(
            id="asset-1",
            assetKey=AssetKey(path=["table"]),
            jobs=[
                JobReference(name="my_pipeline", id="job-1"),
                JobReference(name="other_pipeline", id="job-2"),
            ],
        )
        self.assertTrue(self.dagster._is_asset_in_pipeline(asset, "my_pipeline"))

    def test_is_asset_in_pipeline_false(self):
        """Test _is_asset_in_pipeline returns False when no matching job"""
        asset = DagsterAssetNode(
            id="asset-1",
            assetKey=AssetKey(path=["table"]),
            jobs=[JobReference(name="other_pipeline", id="job-1")],
        )
        self.assertFalse(self.dagster._is_asset_in_pipeline(asset, "my_pipeline"))

    def test_is_asset_in_pipeline_no_jobs(self):
        """Test _is_asset_in_pipeline returns False when asset has no jobs"""
        asset = DagsterAssetNode(
            id="asset-1",
            assetKey=AssetKey(path=["table"]),
            jobs=None,
        )
        self.assertFalse(self.dagster._is_asset_in_pipeline(asset, "my_pipeline"))

    def test_parse_asset_from_materialization_with_metadata(self):
        """Test _parse_asset_from_materialization extracts metadata correctly"""
        asset = DagsterAssetNode(
            id="asset-1",
            assetKey=AssetKey(path=["table"]),
            assetMaterializations=[
                AssetMaterialization(
                    runId="run-1",
                    metadataEntries=[
                        MetadataEntry(
                            **{
                                "__typename": "TextMetadataEntry",
                                "label": "database",
                                "text": "prod_db",
                            }
                        ),
                        MetadataEntry(
                            **{
                                "__typename": "TextMetadataEntry",
                                "label": "schema",
                                "text": "public",
                            }
                        ),
                        MetadataEntry(
                            **{
                                "__typename": "TextMetadataEntry",
                                "label": "table",
                                "text": "users",
                            }
                        ),
                    ],
                )
            ],
        )
        result = self.dagster._parse_asset_from_materialization(asset)
        self.assertIsNotNone(result)
        self.assertEqual(result["database"], "prod_db")
        self.assertEqual(result["schema"], "public")
        self.assertEqual(result["table"], "users")

    def test_parse_asset_from_materialization_no_materializations(self):
        """Test _parse_asset_from_materialization returns None when no materializations"""
        asset = DagsterAssetNode(
            id="asset-1",
            assetKey=AssetKey(path=["table"]),
            assetMaterializations=None,
        )
        result = self.dagster._parse_asset_from_materialization(asset)
        self.assertIsNone(result)

    def test_parse_asset_from_materialization_no_table_entry(self):
        """Test _parse_asset_from_materialization returns None when no table entry"""
        asset = DagsterAssetNode(
            id="asset-1",
            assetKey=AssetKey(path=["table"]),
            assetMaterializations=[
                AssetMaterialization(
                    runId="run-1",
                    metadataEntries=[
                        MetadataEntry(
                            **{
                                "__typename": "TextMetadataEntry",
                                "label": "database",
                                "text": "prod_db",
                            }
                        ),
                    ],
                )
            ],
        )
        result = self.dagster._parse_asset_from_materialization(asset)
        self.assertIsNone(result)

    def test_parse_asset_from_materialization_alternate_labels(self):
        """Test _parse_asset_from_materialization handles alternate label names"""
        asset = DagsterAssetNode(
            id="asset-1",
            assetKey=AssetKey(path=["table"]),
            assetMaterializations=[
                AssetMaterialization(
                    runId="run-1",
                    metadataEntries=[
                        MetadataEntry(
                            **{
                                "__typename": "TextMetadataEntry",
                                "label": "db",
                                "text": "my_database",
                            }
                        ),
                        MetadataEntry(
                            **{
                                "__typename": "TextMetadataEntry",
                                "label": "schema_name",
                                "text": "my_schema",
                            }
                        ),
                        MetadataEntry(
                            **{
                                "__typename": "TextMetadataEntry",
                                "label": "table_name",
                                "text": "my_table",
                            }
                        ),
                    ],
                )
            ],
        )
        result = self.dagster._parse_asset_from_materialization(asset)
        self.assertIsNotNone(result)
        self.assertEqual(result["database"], "my_database")
        self.assertEqual(result["schema"], "my_schema")
        self.assertEqual(result["table"], "my_table")


class TestDagsterSourceWithStripping(TestCase):
    """Test DagsterSource with asset key prefix stripping"""

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    @patch("dagster_graphql.DagsterGraphQLClient")
    def test_dagster_source_with_strip_prefix(self, graphql_client, test_connection):
        """Test DagsterSource correctly loads stripAssetKeyPrefixLength config"""
        test_connection.return_value = False
        graphql_client.return_value = False

        config = {
            "source": {
                "type": "dagster",
                "serviceName": "dagster_test",
                "serviceConnection": {
                    "config": {
                        "type": "Dagster",
                        "host": "http://localhost:3000",
                        "stripAssetKeyPrefixLength": 2,
                    }
                },
                "sourceConfig": {"config": {"type": "PipelineMetadata"}},
            },
            "sink": {"type": "metadata-rest", "config": {}},
            "workflowConfig": {
                "openMetadataServerConfig": {
                    "hostPort": "http://localhost:8585/api",
                    "authProvider": "openmetadata",
                    "securityConfig": {"jwtToken": "token"},
                }
            },
        }

        workflow_config = OpenMetadataWorkflowConfig.model_validate(config)
        dagster_source = DagsterSource.create(
            config["source"],
            workflow_config.workflowConfig.openMetadataServerConfig,
        )

        assert dagster_source.strip_asset_key_prefix_length == 2
