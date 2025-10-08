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
from unittest.mock import patch

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
from metadata.ingestion.source.pipeline.kinesisfirehose.metadata import FirehoseSource

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
        pipeline = list(self.firehose.yield_pipeline(EXPECTED_DELIVERY_STREAM_DETAILS))[
            0
        ].right
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

    def test_malformed_dynamodb_arn(self):
        """Test handling of malformed DynamoDB ARNs"""
        bad_arns = [
            "arn:aws:kinesis:us-east-1:123456789012:stream/MyStream",
            "not-an-arn-at-all",
            "arn:aws:dynamodb:us-east-1:123:invalid-format",
            "",
            "arn:aws:dynamodb:us-east-1:123:table",
        ]
        for arn in bad_arns:
            result = self.firehose._extract_dynamodb_table_from_stream_arn(arn)
            assert result is None, f"Expected None for ARN: {arn}, got {result}"

    def test_valid_dynamodb_arn_extraction(self):
        """Test extraction from various valid DynamoDB ARN formats"""
        test_cases = [
            (
                "arn:aws:dynamodb:us-east-1:123456789012:table/Users/stream/2024-01-01T00:00:00.000",
                "Users",
            ),
            (
                "arn:aws:dynamodb:eu-west-1:999999999999:table/Products/stream/latest",
                "Products",
            ),
            (
                "arn:aws:dynamodb:ap-south-1:111111111111:table/Orders-Prod/stream/12345",
                "Orders-Prod",
            ),
        ]
        for arn, expected_table in test_cases:
            result = self.firehose._extract_dynamodb_table_from_stream_arn(arn)
            assert result == expected_table, f"Expected {expected_table}, got {result}"

    def test_s3_path_with_no_prefix(self):
        """Test S3 path extraction when no prefix is specified"""
        details = {
            "S3DestinationDescription": {
                "BucketARN": "arn:aws:s3:::my-bucket",
                "Prefix": "",
            }
        }
        result = self.firehose._get_s3_path_from_destination(details)
        assert result == "s3://my-bucket/"

    def test_s3_path_with_trailing_slash_in_prefix(self):
        """Test S3 path extraction handles trailing slashes correctly"""
        details = {
            "ExtendedS3DestinationDescription": {
                "BucketARN": "arn:aws:s3:::my-bucket",
                "Prefix": "data/cdc/",
            }
        }
        result = self.firehose._get_s3_path_from_destination(details)
        assert result == "s3://my-bucket/data/cdc/"

    def test_s3_path_missing_bucket_arn(self):
        """Test handling when BucketARN is missing"""
        details = {"S3DestinationDescription": {"Prefix": "cdc/"}}
        result = self.firehose._get_s3_path_from_destination(details)
        assert result is None

    def test_s3_path_with_invalid_arn_format(self):
        """Test handling of invalid S3 ARN formats"""
        details = {
            "S3DestinationDescription": {
                "BucketARN": "arn:aws:s3:us-east-1:123456789012:bucket/my-bucket",
                "Prefix": "cdc/",
            }
        }
        result = self.firehose._get_s3_path_from_destination(details)
        assert result is None

    def test_s3_path_no_destination(self):
        """Test handling when no S3 destination is configured"""
        details = {"DeliveryStreamName": "test-stream"}
        result = self.firehose._get_s3_path_from_destination(details)
        assert result is None

    def test_pipeline_name_missing(self):
        """Test handling when DeliveryStreamName is missing"""
        result = self.firehose.get_pipeline_name({})
        assert result == ""

    def test_empty_delivery_stream_list(self):
        """Test handling of empty delivery stream response"""
        from metadata.ingestion.source.pipeline.kinesisfirehose.models import (
            ListDeliveryStreamsResponse,
        )

        empty_response = {
            "DeliveryStreamNames": [],
            "HasMoreDeliveryStreams": False,
        }
        response = ListDeliveryStreamsResponse.model_validate(empty_response)
        assert response.DeliveryStreamNames == []
        assert response.HasMoreDeliveryStreams is False

    def test_redshift_jdbc_url_parsing(self):
        """Test Redshift JDBC URL database name extraction"""
        test_cases = [
            (
                "jdbc:redshift://my-cluster.us-east-1.redshift.amazonaws.com:5439/analytics",
                "analytics",
            ),
            (
                "jdbc:postgresql://redshift-cluster.region.redshift.amazonaws.com:5439/prod_db",
                "prod_db",
            ),
            (
                "jdbc:redshift://cluster.redshift-serverless.us-west-2.amazonaws.com:5439/dev",
                "dev",
            ),
        ]

        import re

        jdbc_pattern = r"jdbc:(?:redshift|postgresql)://[^/]+/([^?]+)"
        for jdbc_url, expected_db in test_cases:
            match = re.match(jdbc_pattern, jdbc_url)
            assert match is not None, f"Failed to parse JDBC URL: {jdbc_url}"
            assert match.group(1) == expected_db

    def test_redshift_destination_model(self):
        """Test Redshift destination model validation"""
        from metadata.ingestion.source.pipeline.kinesisfirehose.models import (
            RedshiftDestinationDescription,
        )

        redshift_dest = {
            "RoleARN": "arn:aws:iam::123456789012:role/firehose-role",
            "ClusterJDBCURL": "jdbc:redshift://my-cluster.us-east-1.redshift.amazonaws.com:5439/analytics",
            "CopyCommand": {
                "DataTableName": "events",
                "CopyOptions": "JSON 'auto'",
            },
            "Username": "firehose_user",
        }

        dest = RedshiftDestinationDescription.model_validate(redshift_dest)
        assert dest.CopyCommand.DataTableName == "events"
        assert dest.ClusterJDBCURL.endswith("/analytics")
        assert dest.Username == "firehose_user"

    def test_opensearch_destination_model(self):
        """Test OpenSearch destination model validation"""
        from metadata.ingestion.source.pipeline.kinesisfirehose.models import (
            AmazonopensearchserviceDestinationDescription,
        )

        opensearch_dest = {
            "RoleARN": "arn:aws:iam::123456789012:role/firehose-role",
            "DomainARN": "arn:aws:es:us-east-1:123456789012:domain/my-domain",
            "IndexName": "events-index",
            "TypeName": "_doc",
        }

        dest = AmazonopensearchserviceDestinationDescription.model_validate(
            opensearch_dest
        )
        assert dest.IndexName == "events-index"
        assert "my-domain" in dest.DomainARN

    def test_snowflake_destination_model(self):
        """Test Snowflake destination model validation"""
        from metadata.ingestion.source.pipeline.kinesisfirehose.models import (
            SnowflakeDestinationDescription,
        )

        snowflake_dest = {
            "AccountUrl": "https://myaccount.snowflakecomputing.com",
            "User": "firehose_user",
            "Database": "ANALYTICS_DB",
            "Schema": "PUBLIC",
            "Table": "EVENTS",
            "RoleARN": "arn:aws:iam::123456789012:role/firehose-role",
        }

        dest = SnowflakeDestinationDescription.model_validate(snowflake_dest)
        assert dest.Database == "ANALYTICS_DB"
        assert dest.Schema == "PUBLIC"
        assert dest.Table == "EVENTS"

    def test_http_endpoint_destination_model(self):
        """Test HTTP endpoint destination model for MongoDB"""
        from metadata.ingestion.source.pipeline.kinesisfirehose.models import (
            HttpEndpointDestinationDescription,
        )

        http_dest = {
            "EndpointConfiguration": {
                "Url": "https://realm.mongodb.com/api/client/v2.0/app/myapp-abcde/functions/firehose",
                "Name": "MongoDB Atlas",
            },
            "RoleARN": "arn:aws:iam::123456789012:role/firehose-role",
        }

        dest = HttpEndpointDestinationDescription.model_validate(http_dest)
        assert "mongodb" in dest.EndpointConfiguration.Url.lower()
        assert dest.EndpointConfiguration.Name == "MongoDB Atlas"

    def test_delivery_stream_with_redshift_destination(self):
        """Test Redshift destination dict extraction"""
        stream_details = {
            "DeliveryStreamName": "s3-to-redshift",
            "RedshiftDestinationDescription": {
                "RoleARN": "arn:aws:iam::123456789012:role/firehose-role",
                "ClusterJDBCURL": "jdbc:redshift://cluster.us-east-1.redshift.amazonaws.com:5439/analytics",
                "CopyCommand": {"DataTableName": "events"},
            },
        }

        redshift_dest = stream_details.get("RedshiftDestinationDescription")
        assert redshift_dest is not None
        assert redshift_dest["CopyCommand"]["DataTableName"] == "events"
        assert "analytics" in redshift_dest["ClusterJDBCURL"]

    def test_delivery_stream_with_opensearch_destination(self):
        """Test OpenSearch destination dict extraction"""
        stream_details = {
            "DeliveryStreamName": "logs-to-opensearch",
            "AmazonopensearchserviceDestinationDescription": {
                "RoleARN": "arn:aws:iam::123456789012:role/firehose-role",
                "DomainARN": "arn:aws:es:us-east-1:123456789012:domain/logs",
                "IndexName": "application-logs",
            },
        }

        opensearch_dest = stream_details.get(
            "AmazonopensearchserviceDestinationDescription"
        )
        assert opensearch_dest is not None
        assert opensearch_dest["IndexName"] == "application-logs"
        assert "domain/logs" in opensearch_dest["DomainARN"]

    def test_delivery_stream_with_snowflake_destination(self):
        """Test Snowflake destination dict extraction"""
        stream_details = {
            "DeliveryStreamName": "events-to-snowflake",
            "SnowflakeDestinationDescription": {
                "AccountUrl": "https://myaccount.snowflakecomputing.com",
                "User": "firehose_user",
                "Database": "PROD_DB",
                "Schema": "RAW",
                "Table": "EVENTS",
                "RoleARN": "arn:aws:iam::123456789012:role/firehose-role",
            },
        }

        snowflake_dest = stream_details.get("SnowflakeDestinationDescription")
        assert snowflake_dest is not None
        assert snowflake_dest["Database"] == "PROD_DB"
        assert snowflake_dest["Schema"] == "RAW"
        assert snowflake_dest["Table"] == "EVENTS"

    def test_delivery_stream_with_http_endpoint_destination(self):
        """Test HTTP endpoint (MongoDB) destination dict extraction"""
        stream_details = {
            "DeliveryStreamName": "events-to-mongodb",
            "HttpEndpointDestinationDescription": {
                "EndpointConfiguration": {
                    "Url": "https://realm.mongodb.com/api/client/v2.0/app/myapp/functions/firehose",
                    "Name": "MongoDB Atlas",
                },
                "RoleARN": "arn:aws:iam::123456789012:role/firehose-role",
            },
        }

        http_dest = stream_details.get("HttpEndpointDestinationDescription")
        assert http_dest is not None
        endpoint_config = http_dest["EndpointConfiguration"]
        assert "mongodb" in endpoint_config["Url"].lower()
        assert endpoint_config["Name"] == "MongoDB Atlas"

    def test_invalid_jdbc_url_format(self):
        """Test handling of invalid JDBC URL formats"""
        invalid_urls = [
            "not-a-jdbc-url",
            "jdbc:mysql://localhost:3306/db",
            "jdbc:redshift://cluster.region.redshift.amazonaws.com",
            "",
        ]

        import re

        jdbc_pattern = r"jdbc:(?:redshift|postgresql)://[^/]+/([^?]+)"
        for url in invalid_urls:
            match = re.match(jdbc_pattern, url)
            assert match is None, f"Should not match invalid URL: {url}"
