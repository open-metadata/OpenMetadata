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
Example configurations for running all OpenMetadata workflows in parallel
without modifying existing connectors.
"""

# Metadata Ingestion - PostgreSQL Example
METADATA_WORKFLOW_CONFIG = {
    "source_config": {
        "source_class": "ingestion.parallel.adapters.universal_source.MetadataSourceAdapter",
        "config": {
            "source_config": {
                "type": "postgres",
                "serviceName": "postgres_prod",
                "serviceConnection": {
                    "config": {
                        "type": "Postgres",
                        "username": "postgres",
                        "password": "password",
                        "hostPort": "postgres.example.com:5432",
                        "database": "production",
                    }
                },
                "sourceConfig": {
                    "config": {
                        "type": "DatabaseMetadata",
                        "schemaFilterPattern": {"includes": ["public", "analytics"]},
                    }
                },
            },
            "sharding_strategy": {"type": "database"},  # Shard by database
            "metadata_host": "http://openmetadata:8585",
            "auth_provider": "openmetadata",
        },
    },
    "processor_class": "ingestion.parallel.adapters.universal_processor.UniversalProcessorAdapter",
    "processor_config": {"processor_type": None},  # No processor for basic metadata
    "sink_class": "ingestion.parallel.adapters.universal_sink.UniversalSinkAdapter",
    "sink_config": {"sink_type": "metadata"},
}

# Lineage Workflow - BigQuery Example
LINEAGE_WORKFLOW_CONFIG = {
    "source_config": {
        "source_class": "ingestion.parallel.adapters.universal_source.LineageSourceAdapter",
        "config": {
            "source_config": {
                "type": "bigquery-lineage",
                "serviceName": "bigquery_prod",
                "serviceConnection": {
                    "config": {
                        "type": "BigQuery",
                        "credentials": {
                            "gcpConfig": {
                                "type": "service_account",
                                "projectId": "my-project",
                                "privateKey": "-----BEGIN RSA PRIVATE KEY-----",
                            }
                        },
                    }
                },
                "sourceConfig": {
                    "config": {
                        "type": "BigQueryLineage",
                        "queryLogDuration": 7,  # Last 7 days
                    }
                },
            },
            "sharding_strategy": {
                "type": "time_window",
                "window_hours": 6,  # 6-hour windows for parallel processing
            },
            "days_back": 7,
        },
    },
    "processor_class": "ingestion.parallel.adapters.universal_processor.QueryParserProcessorAdapter",
    "sink_class": "ingestion.parallel.adapters.universal_sink.LineageSinkAdapter",
}

# Usage Workflow - Snowflake Example
USAGE_WORKFLOW_CONFIG = {
    "source_config": {
        "source_class": "ingestion.parallel.adapters.universal_source.UsageSourceAdapter",
        "config": {
            "source_config": {
                "type": "snowflake-usage",
                "serviceName": "snowflake_prod",
                "serviceConnection": {
                    "config": {
                        "type": "Snowflake",
                        "username": "openmetadata",
                        "password": "password",
                        "account": "myaccount.us-east-1",
                        "warehouse": "COMPUTE_WH",
                    }
                },
                "sourceConfig": {
                    "config": {
                        "type": "SnowflakeUsage",
                        "queryLogDuration": 30,  # Last 30 days
                    }
                },
            },
            "sharding_strategy": {
                "type": "time_window",
                "window_hours": 24,  # Daily windows
            },
            "days_back": 30,
        },
    },
    "processor_class": "ingestion.parallel.adapters.universal_processor.UniversalProcessorAdapter",
    "sink_class": "ingestion.parallel.adapters.universal_sink.UsageSinkAdapter",
}

# Profiler Workflow - MySQL Example
PROFILER_WORKFLOW_CONFIG = {
    "source_config": {
        "source_class": "ingestion.parallel.adapters.universal_source.ProfilerSourceAdapter",
        "config": {
            "source_config": {
                "type": "mysql",
                "serviceName": "mysql_prod",
                "serviceConnection": {
                    "config": {
                        "type": "Mysql",
                        "username": "openmetadata",
                        "password": "password",
                        "hostPort": "mysql.example.com:3306",
                    }
                },
                "sourceConfig": {
                    "config": {
                        "type": "Profiler",
                        "generateSampleData": True,
                        "profileSample": 80,  # Profile 80% sample
                        "threadCount": 5,
                    }
                },
            },
            "sharding_strategy": {
                "type": "table_count",
                "tables_per_shard": 50,  # 50 tables per shard
            },
            "estimated_tables": 500,
        },
    },
    "processor_class": "ingestion.parallel.adapters.universal_processor.ProfilerProcessorAdapter",
    "processor_config": {
        "profiler_config": {
            "metrics": ["row_count", "column_count", "null_count", "unique_count"]
        }
    },
    "sink_class": "ingestion.parallel.adapters.universal_sink.ProfilerSinkAdapter",
}

# Data Quality Workflow - Redshift Example
DATA_QUALITY_WORKFLOW_CONFIG = {
    "source_config": {
        "source_class": "ingestion.parallel.adapters.universal_source.DataQualitySourceAdapter",
        "config": {
            "source_config": {
                "type": "redshift",
                "serviceName": "redshift_prod",
                "serviceConnection": {
                    "config": {
                        "type": "Redshift",
                        "username": "openmetadata",
                        "password": "password",
                        "hostPort": "redshift-cluster.example.com:5439",
                        "database": "prod",
                    }
                },
            },
            "sharding_strategy": {
                "type": "schema"  # Shard by schema for quality checks
            },
        },
    },
    "processor_class": "ingestion.parallel.adapters.universal_processor.DataQualityProcessorAdapter",
    "processor_config": {
        "test_suite_config": {
            "testCases": [
                {
                    "name": "table_row_count_to_be_between",
                    "config": {"minValue": 100, "maxValue": 1000000},
                },
                {"name": "column_values_to_not_be_null", "columnName": "id"},
            ]
        }
    },
    "sink_class": "ingestion.parallel.adapters.universal_sink.DataQualitySinkAdapter",
}

# DBT Workflow Example
DBT_WORKFLOW_CONFIG = {
    "source_config": {
        "source_class": "ingestion.parallel.adapters.universal_source.MetadataSourceAdapter",
        "config": {
            "source_config": {
                "type": "dbt",
                "serviceName": "dbt_prod",
                "serviceConnection": {
                    "config": {
                        "type": "DBT",
                        "catalog": "s3://my-bucket/dbt/catalog.json",
                        "manifest": "s3://my-bucket/dbt/manifest.json",
                        "runResults": "s3://my-bucket/dbt/run_results.json",
                        "awsConfig": {"awsRegion": "us-east-1"},
                    }
                },
            },
            "sharding_strategy": {"type": "database"},  # DBT models by database
        },
    },
    "processor_class": "ingestion.parallel.adapters.universal_processor.UniversalProcessorAdapter",
    "sink_class": "ingestion.parallel.adapters.universal_sink.UniversalSinkAdapter",
}

# Multi-Database Metadata Ingestion
MULTI_DB_WORKFLOW_CONFIG = {
    "source_config": {
        "source_class": "ingestion.parallel.adapters.universal_source.MetadataSourceAdapter",
        "config": {
            "source_config": {
                "type": "postgres",
                "serviceName": "postgres_cluster",
                "serviceConnection": {
                    "config": {
                        "type": "Postgres",
                        "username": "postgres",
                        "password": "password",
                        "hostPort": "postgres.example.com:5432",
                        "database": "postgres",  # Connect to default
                    }
                },
                "sourceConfig": {
                    "config": {
                        "type": "DatabaseMetadata",
                        "includeDatabases": True,  # Discover all databases
                        "databaseFilterPattern": {
                            "excludes": ["template0", "template1", "postgres"]
                        },
                    }
                },
            },
            "sharding_strategy": {"type": "database"},  # Each database is a shard
        },
    },
    "processor_class": "ingestion.parallel.adapters.universal_processor.PiiProcessorAdapter",
    "processor_config": {
        "processor_config": {"type": "pii", "config": {"confidence": 0.80}}
    },
    "sink_class": "ingestion.parallel.adapters.universal_sink.UniversalSinkAdapter",
}


def get_argo_workflow_params(workflow_type: str) -> dict:
    """
    Get Argo workflow parameters for a specific workflow type.

    Usage:
    params = get_argo_workflow_params("metadata")
    # Then submit to Argo with these parameters
    """
    workflows = {
        "metadata": METADATA_WORKFLOW_CONFIG,
        "lineage": LINEAGE_WORKFLOW_CONFIG,
        "usage": USAGE_WORKFLOW_CONFIG,
        "profiler": PROFILER_WORKFLOW_CONFIG,
        "data_quality": DATA_QUALITY_WORKFLOW_CONFIG,
        "dbt": DBT_WORKFLOW_CONFIG,
        "multi_db": MULTI_DB_WORKFLOW_CONFIG,
    }

    config = workflows.get(workflow_type)
    if not config:
        raise ValueError(f"Unknown workflow type: {workflow_type}")

    # Convert to Argo parameters
    return {
        "source_class": config["source_config"]["source_class"],
        "processor_class": config.get(
            "processor_class",
            "ingestion.parallel.adapters.universal_processor.UniversalProcessorAdapter",
        ),
        "sink_class": config.get(
            "sink_class",
            "ingestion.parallel.adapters.universal_sink.UniversalSinkAdapter",
        ),
        "source_config": config["source_config"],
        "config": {
            "processor_config": config.get("processor_config", {}),
            "sink_config": config.get("sink_config", {}),
        },
        "enable_reduce": workflow_type
        in ["usage", "lineage"],  # These need aggregation
        "workerReplicas": 5
        if workflow_type == "profiler"
        else 3,  # More workers for profiler
    }


if __name__ == "__main__":
    import json
    import sys

    if len(sys.argv) > 1:
        workflow_type = sys.argv[1]
        try:
            params = get_argo_workflow_params(workflow_type)
            print(f"# Argo workflow parameters for {workflow_type}:")
            print(json.dumps(params, indent=2))

            print(f"\n# Submit with:")
            print(
                f"argo submit -n openmetadata --from workflowtemplate/om-parallel-ingestion \\"
            )
            print(f"  -p source_class='{params['source_class']}' \\")
            print(f"  -p processor_class='{params['processor_class']}' \\")
            print(f"  -p sink_class='{params['sink_class']}' \\")
            print(f"  -p config='{json.dumps(params['config'])}' \\")
            print(f"  -p enable_reduce={str(params['enable_reduce']).lower()} \\")
            print(f"  -p workerReplicas={params['workerReplicas']}")
        except ValueError as e:
            print(f"Error: {e}")
            print(
                f"Available workflows: metadata, lineage, usage, profiler, data_quality, dbt, multi_db"
            )
    else:
        print("Usage: python all_workflows.py <workflow_type>")
        print(
            "Available workflows: metadata, lineage, usage, profiler, data_quality, dbt, multi_db"
        )
