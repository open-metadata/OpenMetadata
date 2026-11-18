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

"""Usage ingestion against a catalog and query log owned by the test."""

import csv
from uuid import uuid4

import pytest

from metadata.generated.schema.api.data.createDatabase import CreateDatabaseRequest
from metadata.generated.schema.api.data.createDatabaseSchema import CreateDatabaseSchemaRequest
from metadata.generated.schema.api.data.createTable import CreateTableRequest
from metadata.generated.schema.api.services.createDatabaseService import CreateDatabaseServiceRequest
from metadata.generated.schema.entity.data.table import Column, DataType
from metadata.generated.schema.entity.services.databaseService import DatabaseService, DatabaseServiceType
from metadata.ingestion.ometa.utils import model_str
from metadata.workflow.usage import UsageWorkflow


@pytest.fixture
def usage_service(metadata, cleanup_fqns):
    service = metadata.create_or_update(
        CreateDatabaseServiceRequest(name=f"usage_{uuid4().hex}", serviceType=DatabaseServiceType.BigQuery)
    )
    service_name = model_str(service.fullyQualifiedName)
    cleanup_fqns(DatabaseService, service_name)
    database = metadata.create_or_update(CreateDatabaseRequest(name="ecommerce_db", service=service_name))
    schema = metadata.create_or_update(
        CreateDatabaseSchemaRequest(name="shopify", database=database.fullyQualifiedName)
    )
    for name in ("raw_product_catalog", "dim_customer", "fact_order", "fact_sale", "raw_customer"):
        metadata.create_or_update(
            CreateTableRequest(
                name=name,
                databaseSchema=schema.fullyQualifiedName,
                columns=[Column(name="id", dataType=DataType.BIGINT)],
            )
        )
    return service_name


@pytest.fixture
def query_log(tmp_path, usage_service):
    datasets = tmp_path / "datasets"
    datasets.mkdir()
    (datasets / "service.json").write_text("{}", encoding="utf-8")
    queries = (
        ("SELECT a.id FROM shopify.raw_customer a JOIN dim_customer b ON a.id = b.id", 4),
        ("SELECT a.id FROM shopify.raw_customer a JOIN fact_order b ON a.id = b.id", 4),
        ("SELECT id FROM shopify.raw_customer", 3),
        ("SELECT a.id FROM shopify.raw_product_catalog a JOIN shopify.fact_sale b ON a.id = b.id", 5),
        ("SELECT id FROM shopify.raw_product_catalog", 1),
    )
    with (datasets / "query_log").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=["query"])
        writer.writeheader()
        for query, count in queries:
            writer.writerows({"query": f"{query} /* {usage_service} */"} for _ in range(count))
    return tmp_path


def test_join_count(usage_service, query_log, workflow_config, tmp_path):
    staging = str(tmp_path / "usage_stage")
    workflow = UsageWorkflow.create(
        {
            "source": {
                "type": "custom-database",
                "serviceName": usage_service,
                "serviceConnection": {
                    "config": {
                        "type": "CustomDatabase",
                        "sourcePythonClass": "metadata.ingestion.source.database.sample_usage.SampleUsageSource",
                        "connectionOptions": {"sampleDataFolder": str(query_log)},
                    }
                },
                "sourceConfig": {"config": {"type": "DatabaseUsage"}},
            },
            "processor": {"type": "query-parser", "config": {}},
            "stage": {"type": "table-usage", "config": {"filename": staging}},
            "bulkSink": {"type": "metadata-usage", "config": {"filename": staging}},
            "workflowConfig": workflow_config,
        }
    )
    try:
        workflow.execute()
        workflow.raise_from_status()
        table_usage_map = {key[0]: value.count for key, value in workflow.steps[1].table_usage.items()}
        assert table_usage_map == {
            "ecommerce_db.shopify.raw_product_catalog": 6,
            "ecommerce_db.shopify.dim_customer": 4,
            "ecommerce_db.shopify.fact_order": 4,
            "ecommerce_db.shopify.fact_sale": 5,
            "ecommerce_db.shopify.raw_customer": 11,
        }
    finally:
        workflow.stop()
