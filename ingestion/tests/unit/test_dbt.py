"""
Test dbt
"""

import json
from unittest import TestCase
from unittest.mock import patch

from dbt_artifacts_parser.parser import parse_catalog, parse_manifest, parse_run_results
from pydantic import AnyUrl

from metadata.generated.schema.entity.data.table import Column, DataModel
from metadata.generated.schema.metadataIngestion.workflow import (
    OpenMetadataWorkflowConfig,
)
from metadata.generated.schema.type.entityReference import EntityReference
from metadata.generated.schema.type.tagLabel import TagLabel
from metadata.ingestion.source.database.database_service import DataModelLink
from metadata.ingestion.source.database.dbt.metadata import DbtSource
from metadata.utils.dbt_config import DbtFiles, DbtObjects

mock_dbt_config = {
    "source": {
        "type": "dbt",
        "serviceName": "dbt_test",
        "sourceConfig": {
            "config": {
                "type": "DBT",
                "dbtConfigSource": {
                    "dbtCatalogFilePath": "sample/dbt_files/catalog.json",
                    "dbtManifestFilePath": "sample/dbt_files/manifest.json",
                    "dbtRunResultsFilePath": "sample/dbt_files/run_results.json",
                },
            }
        },
    },
    "sink": {"type": "metadata-rest", "config": {}},
    "workflowConfig": {
        "openMetadataServerConfig": {
            "hostPort": "http://localhost:8585/api",
            "authProvider": "openmetadata",
            "securityConfig": {
                "jwtToken": "eyJraWQiOiJHYjM4OWEtOWY3Ni1nZGpzLWE5MmotMDI0MmJrOTQzNTYiLCJ0eXAiOiJKV1QiLCJhbGc"
                "iOiJSUzI1NiJ9.eyJzdWIiOiJhZG1pbiIsImlzQm90IjpmYWxzZSwiaXNzIjoib3Blbi1tZXRhZGF0YS5vcmciLCJpYXQiOjE"
                "2NjM5Mzg0NjIsImVtYWlsIjoiYWRtaW5Ab3Blbm1ldGFkYXRhLm9yZyJ9.tS8um_5DKu7HgzGBzS1VTA5uUjKWOCU0B_j08WXB"
                "iEC0mr0zNREkqVfwFDD-d24HlNEbrqioLsBuFRiwIWKc1m_ZlVQbG7P36RUxhuv2vbSp80FKyNM-Tj93FDzq91jsyNmsQhyNv_fN"
                "r3TXfzzSPjHt8Go0FMMP66weoKMgW2PbXlhVKwEuXUHyakLLzewm9UMeQaEiRzhiTMU3UkLXcKbYEJJvfNFcLwSl9W8JCO_l0Yj3u"
                "d-qt_nQYEZwqW6u5nfdQllN133iikV4fM5QZsMCnm8Rq1mvLR0y9bmJiD7fwM1tmJ791TUWqmKaTnP49U493VanKpUAfzIiOiIbhg"
            },
        }
    },
}

MOCK_SAMPLE_MANIFEST_V4_V5_V6 = r"""{
    "metadata": {
        "dbt_schema_version": "https://schemas.getdbt.com/dbt/manifest/v6.json",
        "dbt_version": "1.3.0",
        "generated_at": "2023-01-17T19:05:57.859191Z",
        "invocation_id": "0c4757bf-0a8f-4f24-a18a-4c2638bf7d8e",
        "env": {},
        "project_id": "06e5b98c2db46f8a72cc4f66410e9b3b",
        "user_id": null,
        "send_anonymous_usage_stats": true,
        "adapter_type": "redshift"
    },
    "nodes": {
        "model.jaffle_shop.customers": {
            "compiled": true,
            "resource_type": "model",
            "depends_on": {
                "macros": [],
                "nodes": [
                    "model.jaffle_shop.stg_customers",
                    "model.jaffle_shop.stg_orders",
                    "model.jaffle_shop.stg_payments"
                ]
            },
            "config": {
                "enabled": true,
                "alias": null,
                "schema": null,
                "database": null,
                "tags": [
                    "model_tag_one",
                    "model_tag_two"
                ],
                "meta": {
                    "owner": "aaron_johnson0"
                },
                "materialized": "table",
                "incremental_strategy": null,
                "persist_docs": {},
                "quoting": {},
                "column_types": {},
                "full_refresh": null,
                "unique_key": null,
                "on_schema_change": "ignore",
                "grants": {},
                "packages": [],
                "docs": {
                    "show": true
                },
                "post-hook": [],
                "pre-hook": []
            },
            "database": "dev",
            "schema": "dbt_jaffle",
            "fqn": [
                "jaffle_shop",
                "customers"
            ],
            "unique_id": "model.jaffle_shop.customers",
            "raw_sql": "sample customers raw code",
            "package_name": "jaffle_shop",
            "root_path": "sample/customers/root/path",
            "path": "customers.sql",
            "original_file_path": "models/customers.sql",
            "name": "customers",
            "alias": "customers",
            "checksum": {
                "name": "sha256",
                "checksum": "455b90a31f418ae776213ad9932c7cb72d19a5269a8c722bd9f4e44957313ce8"
            },
            "tags": [
                "model_tag_one",
                "model_tag_two"
            ],
            "refs": [
                [
                    "stg_customers"
                ],
                [
                    "stg_orders"
                ],
                [
                    "stg_payments"
                ]
            ],
            "sources": [],
            "description": "This table has basic information about a customer, as well as some derived facts based on a customer's orders",
            "columns": {
                "customer_id": {
                    "name": "customer_id",
                    "description": "This is a unique identifier for a customer",
                    "meta": {},
                    "data_type": null,
                    "quote": null,
                    "tags": []
                },
                "first_name": {
                    "name": "first_name",
                    "description": "Customer's first name. PII.",
                    "meta": {},
                    "data_type": null,
                    "quote": null,
                    "tags": []
                },
                "last_name": {
                    "name": "last_name",
                    "description": "Customer's last name. PII.",
                    "meta": {},
                    "data_type": null,
                    "quote": null,
                    "tags": []
                }
            },
            "meta": {
                "owner": "aaron_johnson0"
            },
            "docs": {
                    "show": true
                },
            "patch_path": "jaffle_shop://models/schema.yml",
            "compiled_path": "target/compiled/jaffle_shop/models/customers.sql",
            "build_path": null,
            "deferred": false,
            "unrendered_config": {
                "materialized": "table",
                "tags": [
                    "model_tag_one",
                    "model_tag_two"
                ],
                "meta": {
                    "owner": "aaron_johnson0"
                }
            },
            "created_at": 1673981809.96386,
            "compiled_sql": "sample customers compile code",
            "extra_ctes_injected": true,
            "extra_ctes": [],
            "relation_name": "\"dev\".\"dbt_jaffle\".\"customers\""
        },
        "model.jaffle_shop.orders": {
            "compiled": true,
            "resource_type": "model",
            "depends_on": {
                "macros": [],
                "nodes": [
                    "model.jaffle_shop.stg_orders",
                    "model.jaffle_shop.stg_payments"
                ]
            },
            "config": {
                "enabled": true,
                "alias": null,
                "schema": null,
                "database": null,
                "tags": [
                    "single_tag"
                ],
                "meta": {
                    "owner": "aaron_johnson0"
                },
                "materialized": "table",
                "incremental_strategy": null,
                "persist_docs": {},
                "quoting": {},
                "column_types": {},
                "full_refresh": null,
                "unique_key": null,
                "on_schema_change": "ignore",
                "grants": {},
                "packages": [],
                "docs": {
                    "show": true
                },
                "post-hook": [],
                "pre-hook": []
            },
            "database": "dev",
            "schema": "dbt_jaffle",
            "fqn": [
                "jaffle_shop",
                "orders"
            ],
            "unique_id": "model.jaffle_shop.orders",
            "raw_sql": "sample raw orders code",
            "package_name": "jaffle_shop",
            "root_path": "sample/orders/root/path",
            "path": "orders.sql",
            "original_file_path": "models/orders.sql",
            "name": "orders",
            "alias": "orders",
            "checksum": {
                "name": "sha256",
                "checksum": "53950235d8e29690d259e95ee49bda6a5b7911b44c739b738a646dc6014bcfcd"
            },
            "tags": [
                "single_tag"
            ],
            "refs": [
                [
                    "stg_orders"
                ],
                [
                    "stg_payments"
                ]
            ],
            "sources": [],
            "description": "This table has basic information about orders, as well as some derived facts based on payments",
            "columns": {
                "order_id": {
                    "name": "order_id",
                    "description": "This is a unique identifier for an order",
                    "meta": {},
                    "data_type": null,
                    "quote": null,
                    "tags": []
                },
                "customer_id": {
                    "name": "customer_id",
                    "description": "Foreign key to the customers table",
                    "meta": {},
                    "data_type": null,
                    "quote": null,
                    "tags": []
                }
            },
            "meta": {
                "owner": "aaron_johnson0"
            },
            "docs": {
                    "show": true
                },
            "patch_path": "jaffle_shop://models/schema.yml",
            "compiled_path": "target/compiled/jaffle_shop/models/orders.sql",
            "build_path": null,
            "deferred": false,
            "unrendered_config": {
                "materialized": "table",
                "tags": "single_tag",
                "meta": {
                    "owner": "aaron_johnson0"
                }
            },
            "created_at": 1673982251.742371,
            "compiled_sql": "sample compiled code",
            "extra_ctes_injected": true,
            "extra_ctes": [],
            "relation_name": "\"dev\".\"dbt_jaffle\".\"orders\""
        },
        "model.jaffle_shop.stg_customers": {
            "compiled": true,
            "resource_type": "model",
            "depends_on": {
                "macros": [],
                "nodes": [
                    "seed.jaffle_shop.raw_customers"
                ]
            },
            "config": {
                "enabled": true,
                "alias": null,
                "schema": null,
                "database": null,
                "tags": [],
                "meta": {},
                "materialized": "view",
                "incremental_strategy": null,
                "persist_docs": {},
                "quoting": {},
                "column_types": {},
                "full_refresh": null,
                "unique_key": null,
                "on_schema_change": "ignore",
                "grants": {},
                "packages": [],
                "docs": {
                    "show": true
                },
                "post-hook": [],
                "pre-hook": []
            },
            "database": "dev",
            "schema": "dbt_jaffle",
            "fqn": [
                "jaffle_shop",
                "staging",
                "stg_customers"
            ],
            "unique_id": "model.jaffle_shop.stg_customers",
            "raw_sql": "sample stg_customers raw_code",
            "package_name": "jaffle_shop",
            "root_path": "sample/stg_customers/root/path",
            "path": "staging/stg_customers.sql",
            "original_file_path": "models/staging/stg_customers.sql",
            "name": "stg_customers",
            "alias": "stg_customers",
            "checksum": {
                "name": "sha256",
                "checksum": "6f18a29204dad1de6dbb0c288144c4990742e0a1e065c3b2a67b5f98334c22ba"
            },
            "tags": [],
            "refs": [
                [
                    "raw_customers"
                ]
            ],
            "sources": [],
            "description": "",
            "columns": {
                "customer_id": {
                    "name": "customer_id",
                    "description": "This is a unique identifier for an customer",
                    "meta": {},
                    "data_type": null,
                    "quote": null,
                    "tags": []
                }
            },
            "meta": {},
            "docs": {
                    "show": true
                },
            "patch_path": "jaffle_shop://models/staging/schema.yml",
            "compiled_path": "target/compiled/jaffle_shop/models/staging/stg_customers.sql",
            "build_path": null,
            "deferred": false,
            "unrendered_config": {
                "materialized": "view"
            },
            "created_at": 1673978228.757611,
            "compiled_sql": "sample stg_customers compiled code",
            "extra_ctes_injected": true,
            "extra_ctes": [],
            "relation_name": "\"dev\".\"dbt_jaffle\".\"stg_customers\""
        }
    },
    "sources": {},
    "macros": {
       
    },
    "docs": {
    },
    "exposures": {},
    "metrics": {},
    "selectors": {},
    "disabled": {},
    "parent_map": {},
    "child_map": {}
}
"""

MOCK_SAMPLE_MANIFEST_V7 = r"""
{
    "metadata": {
        "dbt_schema_version": "https://schemas.getdbt.com/dbt/manifest/v7.json",
        "dbt_version": "1.3.0",
        "generated_at": "2023-01-17T19:05:57.859191Z",
        "invocation_id": "0c4757bf-0a8f-4f24-a18a-4c2638bf7d8e",
        "env": {},
        "project_id": "06e5b98c2db46f8a72cc4f66410e9b3b",
        "user_id": null,
        "send_anonymous_usage_stats": true,
        "adapter_type": "redshift"
    },
    "nodes": {
        "model.jaffle_shop.customers": {
            "compiled": true,
            "resource_type": "model",
            "depends_on": {
                "macros": [],
                "nodes": [
                    "model.jaffle_shop.stg_customers",
                    "model.jaffle_shop.stg_orders",
                    "model.jaffle_shop.stg_payments"
                ]
            },
            "config": {
                "enabled": true,
                "alias": null,
                "schema": null,
                "database": null,
                "tags": [
                    "model_tag_one",
                    "model_tag_two"
                ],
                "meta": {
                    "owner": "aaron_johnson0"
                },
                "materialized": "table",
                "incremental_strategy": null,
                "persist_docs": {},
                "quoting": {},
                "column_types": {},
                "full_refresh": null,
                "unique_key": null,
                "on_schema_change": "ignore",
                "grants": {},
                "packages": [],
                "docs": {
                    "show": true,
                    "node_color": null
                },
                "post-hook": [],
                "pre-hook": []
            },
            "database": "dev",
            "schema": "dbt_jaffle",
            "fqn": [
                "jaffle_shop",
                "customers"
            ],
            "unique_id": "model.jaffle_shop.customers",
            "raw_code": "sample customers raw code",
            "language": "sql",
            "package_name": "jaffle_shop",
            "root_path": "sample/customers/root/path",
            "path": "customers.sql",
            "original_file_path": "models/customers.sql",
            "name": "customers",
            "alias": "customers",
            "checksum": {
                "name": "sha256",
                "checksum": "455b90a31f418ae776213ad9932c7cb72d19a5269a8c722bd9f4e44957313ce8"
            },
            "tags": [
                "model_tag_one",
                "model_tag_two"
            ],
            "refs": [
                [
                    "stg_customers"
                ],
                [
                    "stg_orders"
                ],
                [
                    "stg_payments"
                ]
            ],
            "sources": [],
            "metrics": [],
            "description": "This table has basic information about a customer, as well as some derived facts based on a customer's orders",
            "columns": {
                "customer_id": {
                    "name": "customer_id",
                    "description": "This is a unique identifier for a customer",
                    "meta": {},
                    "data_type": null,
                    "quote": null,
                    "tags": []
                },
                "first_name": {
                    "name": "first_name",
                    "description": "Customer's first name. PII.",
                    "meta": {},
                    "data_type": null,
                    "quote": null,
                    "tags": []
                },
                "last_name": {
                    "name": "last_name",
                    "description": "Customer's last name. PII.",
                    "meta": {},
                    "data_type": null,
                    "quote": null,
                    "tags": []
                }
            },
            "meta": {
                "owner": "aaron_johnson0"
            },
            "docs": {
                "show": true,
                "node_color": null
            },
            "patch_path": "jaffle_shop://models/schema.yml",
            "compiled_path": "target/compiled/jaffle_shop/models/customers.sql",
            "build_path": null,
            "deferred": false,
            "unrendered_config": {
                "materialized": "table",
                "tags": [
                    "model_tag_one",
                    "model_tag_two"
                ],
                "meta": {
                    "owner": "aaron_johnson0"
                }
            },
            "created_at": 1673981809.96386,
            "compiled_code": "sample customers compile code",
            "extra_ctes_injected": true,
            "extra_ctes": [],
            "relation_name": "\"dev\".\"dbt_jaffle\".\"customers\""
        },
        "model.jaffle_shop.orders": {
            "compiled": true,
            "resource_type": "model",
            "depends_on": {
                "macros": [],
                "nodes": [
                    "model.jaffle_shop.stg_orders",
                    "model.jaffle_shop.stg_payments"
                ]
            },
            "config": {
                "enabled": true,
                "alias": null,
                "schema": null,
                "database": null,
                "tags": [
                    "single_tag"
                ],
                "meta": {
                    "owner": "aaron_johnson0"
                },
                "materialized": "table",
                "incremental_strategy": null,
                "persist_docs": {},
                "quoting": {},
                "column_types": {},
                "full_refresh": null,
                "unique_key": null,
                "on_schema_change": "ignore",
                "grants": {},
                "packages": [],
                "docs": {
                    "show": true,
                    "node_color": null
                },
                "post-hook": [],
                "pre-hook": []
            },
            "database": "dev",
            "schema": "dbt_jaffle",
            "fqn": [
                "jaffle_shop",
                "orders"
            ],
            "unique_id": "model.jaffle_shop.orders",
            "raw_code": "sample raw orders code",
            "language": "sql",
            "package_name": "jaffle_shop",
            "root_path": "sample/orders/root/path",
            "path": "orders.sql",
            "original_file_path": "models/orders.sql",
            "name": "orders",
            "alias": "orders",
            "checksum": {
                "name": "sha256",
                "checksum": "53950235d8e29690d259e95ee49bda6a5b7911b44c739b738a646dc6014bcfcd"
            },
            "tags": [
                "single_tag"
            ],
            "refs": [
                [
                    "stg_orders"
                ],
                [
                    "stg_payments"
                ]
            ],
            "sources": [],
            "metrics": [],
            "description": "This table has basic information about orders, as well as some derived facts based on payments",
            "columns": {
                "order_id": {
                    "name": "order_id",
                    "description": "This is a unique identifier for an order",
                    "meta": {},
                    "data_type": null,
                    "quote": null,
                    "tags": []
                },
                "customer_id": {
                    "name": "customer_id",
                    "description": "Foreign key to the customers table",
                    "meta": {},
                    "data_type": null,
                    "quote": null,
                    "tags": []
                }
            },
            "meta": {
                "owner": "aaron_johnson0"
            },
            "docs": {
                "show": true,
                "node_color": null
            },
            "patch_path": "jaffle_shop://models/schema.yml",
            "compiled_path": "target/compiled/jaffle_shop/models/orders.sql",
            "build_path": null,
            "deferred": false,
            "unrendered_config": {
                "materialized": "table",
                "tags": "single_tag",
                "meta": {
                    "owner": "aaron_johnson0"
                }
            },
            "created_at": 1673982251.742371,
            "compiled_code": "sample compiled code",
            "extra_ctes_injected": true,
            "extra_ctes": [],
            "relation_name": "\"dev\".\"dbt_jaffle\".\"orders\""
        },
        "model.jaffle_shop.stg_customers": {
            "compiled": true,
            "resource_type": "model",
            "depends_on": {
                "macros": [],
                "nodes": [
                    "seed.jaffle_shop.raw_customers"
                ]
            },
            "config": {
                "enabled": true,
                "alias": null,
                "schema": null,
                "database": null,
                "tags": [],
                "meta": {},
                "materialized": "view",
                "incremental_strategy": null,
                "persist_docs": {},
                "quoting": {},
                "column_types": {},
                "full_refresh": null,
                "unique_key": null,
                "on_schema_change": "ignore",
                "grants": {},
                "packages": [],
                "docs": {
                    "show": true,
                    "node_color": null
                },
                "post-hook": [],
                "pre-hook": []
            },
            "database": "dev",
            "schema": "dbt_jaffle",
            "fqn": [
                "jaffle_shop",
                "staging",
                "stg_customers"
            ],
            "unique_id": "model.jaffle_shop.stg_customers",
            "raw_code": "sample stg_customers raw_code",
            "language": "sql",
            "package_name": "jaffle_shop",
            "root_path": "sample/stg_customers/root/path",
            "path": "staging/stg_customers.sql",
            "original_file_path": "models/staging/stg_customers.sql",
            "name": "stg_customers",
            "alias": "stg_customers",
            "checksum": {
                "name": "sha256",
                "checksum": "6f18a29204dad1de6dbb0c288144c4990742e0a1e065c3b2a67b5f98334c22ba"
            },
            "tags": [],
            "refs": [
                [
                    "raw_customers"
                ]
            ],
            "sources": [],
            "metrics": [],
            "description": "",
            "columns": {
                "customer_id": {
                    "name": "customer_id",
                    "description": "This is a unique identifier for an customer",
                    "meta": {},
                    "data_type": null,
                    "quote": null,
                    "tags": []
                }
            },
            "meta": {},
            "docs": {
                "show": true,
                "node_color": null
            },
            "patch_path": "jaffle_shop://models/staging/schema.yml",
            "compiled_path": "target/compiled/jaffle_shop/models/staging/stg_customers.sql",
            "build_path": null,
            "deferred": false,
            "unrendered_config": {
                "materialized": "view"
            },
            "created_at": 1673978228.757611,
            "compiled_code": "sample stg_customers compiled code",
            "extra_ctes_injected": true,
            "extra_ctes": [],
            "relation_name": "\"dev\".\"dbt_jaffle\".\"stg_customers\""
        }
    },
    "sources": {},
    "macros": {
       
    },
    "docs": {
    },
    "exposures": {},
    "metrics": {},
    "selectors": {},
    "disabled": {},
    "parent_map": {},
    "child_map": {}
}
"""

MOCK_SAMPLE_MANIFEST_V8 = r"""{
    "metadata": {
        "dbt_schema_version": "https://schemas.getdbt.com/dbt/manifest/v8.json",
        "dbt_version": "1.3.0",
        "generated_at": "2023-01-17T19:05:57.859191Z",
        "invocation_id": "0c4757bf-0a8f-4f24-a18a-4c2638bf7d8e",
        "env": {},
        "project_id": "06e5b98c2db46f8a72cc4f66410e9b3b",
        "user_id": null,
        "send_anonymous_usage_stats": true,
        "adapter_type": "redshift"
    },
    "nodes": {
        "model.jaffle_shop.customers": {
            "compiled": true,
            "resource_type": "model",
            "depends_on": {
                "macros": [],
                "nodes": [
                    "model.jaffle_shop.stg_customers",
                    "model.jaffle_shop.stg_orders",
                    "model.jaffle_shop.stg_payments"
                ]
            },
            "config": {
                "enabled": true,
                "alias": null,
                "schema": null,
                "database": null,
                "tags": [
                    "model_tag_one",
                    "model_tag_two"
                ],
                "meta": {
                    "owner": "aaron_johnson0"
                },
                "materialized": "table",
                "incremental_strategy": null,
                "persist_docs": {},
                "quoting": {},
                "column_types": {},
                "full_refresh": null,
                "unique_key": null,
                "on_schema_change": "ignore",
                "grants": {},
                "packages": [],
                "docs": {
                    "show": true,
                    "node_color": null
                },
                "post-hook": [],
                "pre-hook": []
            },
            "database": "dev",
            "schema": "dbt_jaffle",
            "fqn": [
                "jaffle_shop",
                "customers"
            ],
            "unique_id": "model.jaffle_shop.customers",
            "raw_code": "sample customers raw code",
            "language": "sql",
            "package_name": "jaffle_shop",
            "path": "customers.sql",
            "original_file_path": "sample/customers/root/path/models/customers.sql",
            "name": "customers",
            "alias": "customers",
            "checksum": {
                "name": "sha256",
                "checksum": "455b90a31f418ae776213ad9932c7cb72d19a5269a8c722bd9f4e44957313ce8"
            },
            "tags": [
                "model_tag_one",
                "model_tag_two"
            ],
            "refs": [
                [
                    "stg_customers"
                ],
                [
                    "stg_orders"
                ],
                [
                    "stg_payments"
                ]
            ],
            "sources": [],
            "metrics": [],
            "description": "This table has basic information about a customer, as well as some derived facts based on a customer's orders",
            "columns": {
                "customer_id": {
                    "name": "customer_id",
                    "description": "This is a unique identifier for a customer",
                    "meta": {},
                    "data_type": null,
                    "quote": null,
                    "tags": []
                },
                "first_name": {
                    "name": "first_name",
                    "description": "Customer's first name. PII.",
                    "meta": {},
                    "data_type": null,
                    "quote": null,
                    "tags": []
                },
                "last_name": {
                    "name": "last_name",
                    "description": "Customer's last name. PII.",
                    "meta": {},
                    "data_type": null,
                    "quote": null,
                    "tags": []
                }
            },
            "meta": {
                "owner": "aaron_johnson0"
            },
            "docs": {
                "show": true,
                "node_color": null
            },
            "patch_path": "jaffle_shop://models/schema.yml",
            "compiled_path": "target/compiled/jaffle_shop/models/customers.sql",
            "build_path": null,
            "deferred": false,
            "unrendered_config": {
                "materialized": "table",
                "tags": [
                    "model_tag_one",
                    "model_tag_two"
                ],
                "meta": {
                    "owner": "aaron_johnson0"
                }
            },
            "created_at": 1673981809.96386,
            "compiled_code": "sample customers compile code",
            "extra_ctes_injected": true,
            "extra_ctes": [],
            "relation_name": "\"dev\".\"dbt_jaffle\".\"customers\""
        },
        "model.jaffle_shop.orders": {
            "compiled": true,
            "resource_type": "model",
            "depends_on": {
                "macros": [],
                "nodes": [
                    "model.jaffle_shop.stg_orders",
                    "model.jaffle_shop.stg_payments"
                ]
            },
            "config": {
                "enabled": true,
                "alias": null,
                "schema": null,
                "database": null,
                "tags": [
                    "single_tag"
                ],
                "meta": {
                    "owner": "aaron_johnson0"
                },
                "materialized": "table",
                "incremental_strategy": null,
                "persist_docs": {},
                "quoting": {},
                "column_types": {},
                "full_refresh": null,
                "unique_key": null,
                "on_schema_change": "ignore",
                "grants": {},
                "packages": [],
                "docs": {
                    "show": true,
                    "node_color": null
                },
                "post-hook": [],
                "pre-hook": []
            },
            "database": "dev",
            "schema": "dbt_jaffle",
            "fqn": [
                "jaffle_shop",
                "orders"
            ],
            "unique_id": "model.jaffle_shop.orders",
            "raw_code": "sample raw orders code",
            "language": "sql",
            "package_name": "jaffle_shop",
            "path": "orders.sql",
            "original_file_path": "sample/orders/root/path/models/orders.sql",
            "name": "orders",
            "alias": "orders",
            "checksum": {
                "name": "sha256",
                "checksum": "53950235d8e29690d259e95ee49bda6a5b7911b44c739b738a646dc6014bcfcd"
            },
            "tags": [
                "single_tag"
            ],
            "refs": [
                [
                    "stg_orders"
                ],
                [
                    "stg_payments"
                ]
            ],
            "sources": [],
            "metrics": [],
            "description": "This table has basic information about orders, as well as some derived facts based on payments",
            "columns": {
                "order_id": {
                    "name": "order_id",
                    "description": "This is a unique identifier for an order",
                    "meta": {},
                    "data_type": null,
                    "quote": null,
                    "tags": []
                },
                "customer_id": {
                    "name": "customer_id",
                    "description": "Foreign key to the customers table",
                    "meta": {},
                    "data_type": null,
                    "quote": null,
                    "tags": []
                }
            },
            "meta": {
                "owner": "aaron_johnson0"
            },
            "docs": {
                "show": true,
                "node_color": null
            },
            "patch_path": "jaffle_shop://models/schema.yml",
            "compiled_path": "target/compiled/jaffle_shop/models/orders.sql",
            "build_path": null,
            "deferred": false,
            "unrendered_config": {
                "materialized": "table",
                "tags": "single_tag",
                "meta": {
                    "owner": "aaron_johnson0"
                }
            },
            "created_at": 1673982251.742371,
            "compiled_code": "sample compiled code",
            "extra_ctes_injected": true,
            "extra_ctes": [],
            "relation_name": "\"dev\".\"dbt_jaffle\".\"orders\""
        },
        "model.jaffle_shop.stg_customers": {
            "compiled": true,
            "resource_type": "model",
            "depends_on": {
                "macros": [],
                "nodes": [
                    "seed.jaffle_shop.raw_customers"
                ]
            },
            "config": {
                "enabled": true,
                "alias": null,
                "schema": null,
                "database": null,
                "tags": [],
                "meta": {},
                "materialized": "view",
                "incremental_strategy": null,
                "persist_docs": {},
                "quoting": {},
                "column_types": {},
                "full_refresh": null,
                "unique_key": null,
                "on_schema_change": "ignore",
                "grants": {},
                "packages": [],
                "docs": {
                    "show": true,
                    "node_color": null
                },
                "post-hook": [],
                "pre-hook": []
            },
            "database": "dev",
            "schema": "dbt_jaffle",
            "fqn": [
                "jaffle_shop",
                "staging",
                "stg_customers"
            ],
            "unique_id": "model.jaffle_shop.stg_customers",
            "raw_code": "sample stg_customers raw_code",
            "language": "sql",
            "package_name": "jaffle_shop",
            "path": "staging/stg_customers.sql",
            "original_file_path": "sample/stg_customers/root/path/models/staging/stg_customers.sql",
            "name": "stg_customers",
            "alias": "stg_customers",
            "checksum": {
                "name": "sha256",
                "checksum": "6f18a29204dad1de6dbb0c288144c4990742e0a1e065c3b2a67b5f98334c22ba"
            },
            "tags": [],
            "refs": [
                [
                    "raw_customers"
                ]
            ],
            "sources": [],
            "metrics": [],
            "description": "",
            "columns": {
                "customer_id": {
                    "name": "customer_id",
                    "description": "This is a unique identifier for an customer",
                    "meta": {},
                    "data_type": null,
                    "quote": null,
                    "tags": []
                }
            },
            "meta": {},
            "docs": {
                "show": true,
                "node_color": null
            },
            "patch_path": "jaffle_shop://models/staging/schema.yml",
            "compiled_path": "target/compiled/jaffle_shop/models/staging/stg_customers.sql",
            "build_path": null,
            "deferred": false,
            "unrendered_config": {
                "materialized": "view"
            },
            "created_at": 1673978228.757611,
            "compiled_code": "sample stg_customers compiled code",
            "extra_ctes_injected": true,
            "extra_ctes": [],
            "relation_name": "\"dev\".\"dbt_jaffle\".\"stg_customers\""
        }
    },
    "sources": {},
    "macros": {
       
    },
    "docs": {
    },
    "exposures": {},
    "metrics": {},
    "selectors": {},
    "disabled": {},
    "parent_map": {},
    "child_map": {}
}
"""


EXPECTED_DATA_MODEL_FQNS = [
    "dbt_test.dev.dbt_jaffle.customers",
    "dbt_test.dev.dbt_jaffle.orders",
    "dbt_test.dev.dbt_jaffle.stg_customers",
]

EXPECTED_DATA_MODELS = [
    DataModel(
        modelType="DBT",
        description="This table has basic information about a customer, as well as some derived facts based on a customer's orders",
        path="sample/customers/root/path/models/customers.sql",
        rawSql="sample customers raw code",
        sql="sample customers compile code",
        upstream=["dbt_test.dev.dbt_jaffle.stg_customers"],
        owner=EntityReference(
            id="cb2a92f5-e935-4ad7-911c-654280046538",
            type="user",
            name=None,
            fullyQualifiedName="aaron_johnson0",
            description=None,
            displayName=None,
            deleted=None,
            href=AnyUrl(
                "http://localhost:8585/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
            ),
        ),
        tags=[
            TagLabel(
                tagFQN="dbtTags.model_tag_one",
                description=None,
                source="Tag",
                labelType="Automated",
                state="Confirmed",
                href=None,
            ),
            TagLabel(
                tagFQN="dbtTags.model_tag_two",
                description=None,
                source="Tag",
                labelType="Automated",
                state="Confirmed",
                href=None,
            ),
        ],
        columns=[
            Column(
                name="customer_id",
                dataType="VARCHAR",
                dataLength=1,
                description="This is a unique identifier for a customer",
            ),
            Column(
                name="first_name",
                dataType="VARCHAR",
                dataLength=1,
                description="Customer's first name. PII.",
            ),
            Column(
                name="last_name",
                dataType="VARCHAR",
                dataLength=1,
                description="Customer's last name. PII.",
            ),
        ],
        generatedAt=None,
    ),
    DataModel(
        modelType="DBT",
        description="This table has basic information about orders, as well as some derived facts based on payments",
        path="sample/orders/root/path/models/orders.sql",
        rawSql="sample raw orders code",
        sql="sample compiled code",
        upstream=[],
        owner=EntityReference(
            id="cb2a92f5-e935-4ad7-911c-654280046538",
            type="user",
            name=None,
            fullyQualifiedName="aaron_johnson0",
            description=None,
            displayName=None,
            deleted=None,
            href=AnyUrl(
                "http://localhost:8585/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
            ),
        ),
        tags=[
            TagLabel(
                tagFQN="dbtTags.single_tag",
                description=None,
                source="Tag",
                labelType="Automated",
                state="Confirmed",
                href=None,
            )
        ],
        columns=[
            Column(
                name="order_id",
                displayName=None,
                dataType="VARCHAR",
                dataLength=1,
                description="This is a unique identifier for an order",
            ),
            Column(
                name="customer_id",
                displayName=None,
                dataType="VARCHAR",
                dataLength=1,
                description="Foreign key to the customers table",
            ),
        ],
        generatedAt=None,
    ),
    DataModel(
        modelType="DBT",
        description=None,
        path="sample/stg_customers/root/path/models/staging/stg_customers.sql",
        rawSql="sample stg_customers raw_code",
        sql="sample stg_customers compiled code",
        upstream=[],
        owner=EntityReference(
            id="cb2a92f5-e935-4ad7-911c-654280046538",
            type="user",
            name=None,
            fullyQualifiedName="aaron_johnson0",
            description=None,
            displayName=None,
            deleted=None,
            href=AnyUrl(
                "http://localhost:8585/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
                scheme="http",
                host="localhost",
                host_type="int_domain",
                port="8585",
                path="/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
            ),
        ),
        tags=None,
        columns=[
            Column(
                name="customer_id",
                displayName=None,
                dataType="VARCHAR",
                dataLength=1,
                description="This is a unique identifier for an customer",
            )
        ],
        generatedAt=None,
    ),
]

MOCK_OWNER = EntityReference(
    id="cb2a92f5-e935-4ad7-911c-654280046538",
    type="user",
    name=None,
    fullyQualifiedName="aaron_johnson0",
    description=None,
    displayName=None,
    deleted=None,
    href=AnyUrl(
        "http://localhost:8585/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
        scheme="http",
        host="localhost",
        host_type="int_domain",
        port="8585",
        path="/api/v1/users/cb2a92f5-e935-4ad7-911c-654280046538",
    ),
)


class DbtUnitTest(TestCase):
    """
    Implements the necessary methods to extract
    dbt Unit Test
    """

    @patch("metadata.ingestion.source.database.dbt.metadata.DbtSource.test_connection")
    def __init__(self, methodName, test_connection) -> None:
        super().__init__(methodName)
        test_connection.return_value = False
        self.config = OpenMetadataWorkflowConfig.parse_obj(mock_dbt_config)
        self.dbt_source_obj = DbtSource.create(
            mock_dbt_config["source"],
            self.config.workflowConfig.openMetadataServerConfig,
        )

    @patch("metadata.ingestion.source.database.dbt.metadata.DbtSource.get_dbt_owner")
    def test_dbt_manifest_v4_v5_v6(self, get_dbt_owner):
        get_dbt_owner.return_value = MOCK_OWNER
        dbt_files = DbtFiles(dbt_manifest=json.loads(MOCK_SAMPLE_MANIFEST_V4_V5_V6))
        dbt_objects = DbtObjects(
            dbt_catalog=parse_catalog(dbt_files.dbt_catalog)
            if dbt_files.dbt_catalog
            else None,
            dbt_manifest=parse_manifest(dbt_files.dbt_manifest),
            dbt_run_results=parse_run_results(dbt_files.dbt_run_results)
            if dbt_files.dbt_run_results
            else None,
        )
        self.check_dbt_validate(dbt_files=dbt_files)
        self.check_yield_datamodel(dbt_objects=dbt_objects)

    @patch("metadata.ingestion.source.database.dbt.metadata.DbtSource.get_dbt_owner")
    def test_dbt_manifest_v7(self, get_dbt_owner):
        get_dbt_owner.return_value = MOCK_OWNER
        dbt_files = DbtFiles(dbt_manifest=json.loads(MOCK_SAMPLE_MANIFEST_V7))
        dbt_objects = DbtObjects(
            dbt_catalog=parse_catalog(dbt_files.dbt_catalog)
            if dbt_files.dbt_catalog
            else None,
            dbt_manifest=parse_manifest(dbt_files.dbt_manifest),
            dbt_run_results=parse_run_results(dbt_files.dbt_run_results)
            if dbt_files.dbt_run_results
            else None,
        )
        self.check_dbt_validate(dbt_files=dbt_files)
        self.check_yield_datamodel(dbt_objects=dbt_objects)

    @patch("metadata.ingestion.source.database.dbt.metadata.DbtSource.get_dbt_owner")
    def test_dbt_manifest_v8(self, get_dbt_owner):
        get_dbt_owner.return_value = MOCK_OWNER
        dbt_files = DbtFiles(dbt_manifest=json.loads(MOCK_SAMPLE_MANIFEST_V8))
        dbt_objects = DbtObjects(
            dbt_catalog=parse_catalog(dbt_files.dbt_catalog)
            if dbt_files.dbt_catalog
            else None,
            dbt_manifest=parse_manifest(dbt_files.dbt_manifest),
            dbt_run_results=parse_run_results(dbt_files.dbt_run_results)
            if dbt_files.dbt_run_results
            else None,
        )
        self.check_dbt_validate(dbt_files=dbt_files)
        self.check_yield_datamodel(dbt_objects=dbt_objects)

    def check_dbt_validate(self, dbt_files):
        with self.assertLogs() as captured:
            self.dbt_source_obj.validate_dbt_files(dbt_files=dbt_files)
        self.assertEqual(len(captured.records), 4)
        for record in captured.records:
            self.assertNotIn("Error", record.getMessage())
            self.assertNotIn("Unable", record.getMessage())

    def check_yield_datamodel(self, dbt_objects):
        data_model_list = []
        yield_data_models = self.dbt_source_obj.yield_data_models(
            dbt_objects=dbt_objects
        )
        for data_model_link in yield_data_models:
            if isinstance(data_model_link, DataModelLink):
                self.assertIn(data_model_link.fqn.__root__, EXPECTED_DATA_MODEL_FQNS)
                data_model_list.append(data_model_link.datamodel)

        for _, (exptected, original) in enumerate(
            zip(EXPECTED_DATA_MODELS, data_model_list)
        ):
            self.assertEqual(exptected, original)
