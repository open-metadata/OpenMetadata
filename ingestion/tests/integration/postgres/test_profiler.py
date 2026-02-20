from copy import deepcopy

import pytest
from sqlalchemy import create_engine, text

from _openmetadata_testutils.pydantic.test_utils import assert_equal_pydantic_objects
from metadata.generated.schema.entity.data.table import ColumnProfile
from metadata.ingestion.lineage.sql_lineage import search_cache
from metadata.workflow.metadata import MetadataWorkflow
from metadata.workflow.profiler import ProfilerWorkflow


@pytest.fixture(scope="module")
def prepare_postgres(postgres_container):
    engine = create_engine(postgres_container.get_connection_url())
    sql = [
        "CREATE TABLE financial_transactions (id SERIAL PRIMARY KEY, amount MONEY);",
        "INSERT INTO financial_transactions (amount) VALUES (100.00), (200.00), (300.00), (400.00), (500.00);",
    ]
    with engine.begin() as conn:
        for stmt in sql:
            conn.execute(text(stmt))


@pytest.fixture(scope="module")
def run_profiler(
    patch_passwords_for_db_services,
    prepare_postgres,
    run_workflow,
    ingestion_config,
    profiler_config,
):
    search_cache.clear()
    config = deepcopy(ingestion_config)
    config["source"]["sourceConfig"]["config"]["schemaFilterPattern"] = {
        "excludes": ["information_schema"]
    }
    run_workflow(MetadataWorkflow, config)
    run_workflow(ProfilerWorkflow, profiler_config)


@pytest.mark.parametrize(
    "table_fqn,expected_column_profiles",
    [
        [
            "{service}.dvdrental.public.financial_transactions",
            {
                "id": ColumnProfile.model_validate(
                    {
                        "name": "id",
                        "timestamp": 1724343985740,
                        "valuesCount": 5.0,
                        "nullCount": 0.0,
                        "nullProportion": 0.0,
                        "uniqueCount": 5.0,
                        "uniqueProportion": 1.0,
                        "distinctCount": 5.0,
                        "distinctProportion": 1.0,
                        "min": 1.0,
                        "max": 5.0,
                        "mean": 3.0,
                        "sum": 15.0,
                        "stddev": 1.414213562373095,
                        "median": 3.0,
                        "firstQuartile": 2.0,
                        "thirdQuartile": 4.0,
                        "interQuartileRange": 2.0,
                        "nonParametricSkew": 0.0,
                        "histogram": {
                            "boundaries": ["1.000 to 3.339", "3.339 and up"],
                            "frequencies": [3, 2],
                        },
                    }
                ),
                "amount": ColumnProfile.model_validate(
                    {
                        "name": "amount",
                        "timestamp": 1724343985743,
                        "valuesCount": 5.0,
                        "nullCount": 0.0,
                        "nullProportion": 0.0,
                        "uniqueCount": 5.0,
                        "uniqueProportion": 1.0,
                        "distinctCount": 5.0,
                        "distinctProportion": 1.0,
                        "min": "$100.00",
                        "max": "$500.00",
                        "mean": 300.0,
                        "sum": 1500.0,
                        "stddev": 141.4213562373095,
                    }
                ),
            },
        ]
    ],
    ids=lambda x: x.split(".")[-1] if isinstance(x, str) else "",
)
def test_profiler(
    table_fqn,
    expected_column_profiles,
    db_service,
    run_profiler,
    metadata,
):
    table = metadata.get_latest_table_profile(
        table_fqn.format(service=db_service.fullyQualifiedName.root)
    )
    for name, expected_profile in expected_column_profiles.items():
        actual_column_profile = next(
            column for column in table.columns if column.name.root == name
        ).profile
        # the timestamp always changes so we equalize them to avoid comparison
        actual_column_profile.timestamp = expected_profile.timestamp
        assert_equal_pydantic_objects(
            expected_profile,
            actual_column_profile,
        )
