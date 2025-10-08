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
Test Kinesis Firehose using the topology
"""
import json
from unittest import TestCase
from unittest.mock import Mock, patch

from metadata.generated.schema.api.data.createPipeline import CreatePipelineRequest
from metadata.generated.schema.entity.data.pipeline import Pipeline
from metadata.generated.schema.entity.services.pipelineService import (
    PipelineConnection,
    PipelineService,
    PipelineServiceType,
)
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.basic import (
    EntityName,
    FullyQualifiedEntityName,
    SourceUrl,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.ingestion.source.pipeline.kinesisfirehose.metadata import (
    FirehoseSource,
)

mock_firehose_config = {
    "source": {
        "type": "kinesisfirehose",
        "serviceName": "local_firehose",
        "serviceConnection": {
            "config": {
                "type": "KinesisFirehose",
                "awsConfig": {
                    "awsAccessKeyId": "aws_access_key_id",
                    "awsSecretAccessKey": "aws_secret_access_key",
                    "awsRegion": "us-east-1",
                    "endPointURL": "https://firehose.us-east-1.amazonaws.com/",
                },
            },
        },
        "sourceConfig": {"config": {"type": "PipelineMetadata"}},
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

EXPECTED_DELIVERY_STREAM_DETAILS = json.loads(
    """
{
    "DeliveryStreamName": "dynamodb-to-s3-cdc",
    "DeliveryStreamARN": "arn:aws:firehose:us-east-1:123456789012:deliverystream/dynamodb-to-s3-cdc",
    "DeliveryStreamStatus": "ACTIVE",
    "DeliveryStreamType": "KinesisStreamAsSource",
    "CreateTimestamp": 1609459200.0,
    "LastUpdateTimestamp": 1609459200.0,
    "Source": {},
    "Destinations": [
        {
            "DestinationId": "destinationId-000000000001",
            "S3DestinationDescription": {
                "RoleARN": "arn:aws:iam::123456789012:role/firehose-role",
                "BucketARN": "arn:aws:s3:::my-data-lake",
                "Prefix": "cdc/",
                "ErrorOutputPrefix": "errors/"
            }
        }
    ],
    "HasMoreDestinations": false,
    "KinesisStreamSourceConfiguration": {
        "KinesisStreamARN": "arn:aws:dynamodb:us-east-1:123456789012:table/Users/stream/2024-01-01T00:00:00.000",
        "RoleARN": "arn:aws:iam::123456789012:role/firehose-role"
    },
    "S3DestinationDescription": {
        "RoleARN": "arn:aws:iam::123456789012:role/firehose-role",
        "BucketARN": "arn:aws:s3:::my-data-lake",
        "Prefix": "cdc/",
        "ErrorOutputPrefix": "errors/"
    }
}
"""
)

EXPECTED_CREATED_PIPELINE = CreatePipelineRequest(
    name=EntityName(root="dynamodb-to-s3-cdc"),
    displayName="dynamodb-to-s3-cdc",
    description="Firehose delivery stream: KinesisStreamAsSource",
    sourceUrl=SourceUrl(
        root="https://us-east-1.console.aws.amazon.com/firehose/home?region=us-east-1#/details/dynamodb-to-s3-cdc"
    ),
    service=FullyQualifiedEntityName(root="firehose_test"),
)

MOCK_PIPELINE_SERVICE = PipelineService(
    id="85811038-099a-11ed-861d-0242ac120002",
    name="firehose_test",
    fullyQualifiedName=FullyQualifiedEntityName("firehose_test"),
    connection=PipelineConnection(),
    serviceType=PipelineServiceType.KinesisFirehose,
)

MOCK_PIPELINE = Pipeline(
    id="2aaa012e-099a-11ed-861d-0242ac120002",
    name=EntityName(root="dynamodb-to-s3-cdc"),
    fullyQualifiedName="firehose_test.dynamodb-to-s3-cdc",
    displayName="dynamodb-to-s3-cdc",
    description="Firehose delivery stream: KinesisStreamAsSource",
    sourceUrl=SourceUrl(
        root="https://us-east-1.console.aws.amazon.com/firehose/home?region=us-east-1#/details/dynamodb-to-s3-cdc"
    ),
    service=EntityReference(
        id="85811038-099a-11ed-861d-0242ac120002", type="pipelineService"
    ),
)

EXPECTED_PIPELINE_NAME = "dynamodb-to-s3-cdc"


class FirehoseUnitTest(TestCase):
    """
    Kinesis Firehose unit tests
    """

    @patch(
        "metadata.ingestion.source.pipeline.pipeline_service.PipelineServiceSource.test_connection"
    )
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False

        config = OpenMetadataWorkflowConfig.model_validate(mock_firehose_config)
        self.firehose = FirehoseSource.create(
            mock_firehose_config["source"],
            config.workflowConfig.openMetadataServerConfig,
        )
        self.firehose.context.get().__dict__["pipeline"] = MOCK_PIPELINE.name.root
        self.firehose.context.get().__dict__[
            "pipeline_service"
        ] = MOCK_PIPELINE_SERVICE.name.root

    def test_pipeline_name(self):
        assert (
            self.firehose.get_pipeline_name(EXPECTED_DELIVERY_STREAM_DETAILS)
            == EXPECTED_PIPELINE_NAME
        )

    def test_pipeline_creation(self):
        pipeline = list(
            self.firehose.yield_pipeline(EXPECTED_DELIVERY_STREAM_DETAILS)
        )[0].right
        assert pipeline == EXPECTED_CREATED_PIPELINE

    def test_extract_dynamodb_table_from_arn(self):
        arn = "arn:aws:dynamodb:us-east-1:123456789012:table/Users/stream/2024-01-01T00:00:00.000"
        table_name = self.firehose._extract_dynamodb_table_from_stream_arn(arn)
        assert table_name == "Users"

    def test_extract_s3_path_from_destination(self):
        s3_path = self.firehose._get_s3_path_from_destination(
            EXPECTED_DELIVERY_STREAM_DETAILS
        )
        assert s3_path == "s3://my-data-lake/cdc/"

    def test_lineage_table_name_extraction(self):
        """Test that DynamoDB table name can be extracted from stream ARN"""
        table_name = self.firehose._extract_dynamodb_table_from_stream_arn(
            EXPECTED_DELIVERY_STREAM_DETAILS["KinesisStreamSourceConfiguration"][
                "KinesisStreamARN"
            ]
        )
        assert table_name == "Users"

    def test_lineage_s3_path_extraction(self):
        """Test that S3 destination path can be extracted"""
        s3_path = self.firehose._get_s3_path_from_destination(
            EXPECTED_DELIVERY_STREAM_DETAILS
        )
        assert s3_path == "s3://my-data-lake/cdc/"
        assert "cdc/" in s3_path
