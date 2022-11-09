"""
Amundsen helper file for service mapping
"""

SERVICE_TYPE_MAPPER = {
    "hive": {
        "service_name": "Hive",
        "connection": {"config": {"hostPort": "http://nohost:6000", "type": "Hive"}},
    },
    "delta": {
        "service_name": "DeltaLake",
        "connection": {
            "config": {
                "metastoreConnection": {"metastoreHostPort": "http://localhost:9083"}
            }
        },
    },
    "dynamo": {
        "service_name": "DynamoDB",
        "connection": {
            "config": {"awsConfig": {"awsRegion": "aws_region"}, "type": "DynamoDB"}
        },
    },
    "mysql": {
        "service_name": "Mysql",
        "connection": {
            "config": {"hostPort": "http://nohost:6000", "username": "randomName"}
        },
    },
    "athena": {
        "service_name": "Athena",
        "connection": {
            "config": {
                "s3StagingDir": "s3 staging dir",
                "awsConfig": "aws_config",
                "workgroup": "work_group",
            }
        },
    },
    "bigquery": {
        "service_name": "BigQuery",
        "connection": {"config": {"credentials": "credentials"}},
    },
    "db2": {
        "service_name": "Db2",
        "connection": {
            "config": {"hostPort": "http://nohost:6000", "username": "username"}
        },
    },
    "druid": {
        "service_name": "Druid",
        "connection": {"config": {"hostPort": "http://nohost:6000"}},
    },
    "salesforce": {
        "service_name": "Salesforce",
        "connection": {"config": {"username": "randomName"}},
    },
    "oracle": {
        "service_name": "Oracle",
        "connection": {
            "config": {
                "hostPort": "http://nohost:6000",
                "username": "randomName",
                "oracleConnectionType": {
                    "oracleServiceName": {"title": "orcale_ser_name"}
                },
            }
        },
    },
    "glue": {
        "service_name": "Glue",
        "connection": {
            "config": {
                "awsConfig": "aws_config",
                "storageServiceName": "glue_stroage_name",
            }
        },
    },
    "snowflake": {
        "service_nmae": "Snowflake",
        "connection": {
            "config": {
                "username": "randomName",
                "account": "snow_fl_acco",
                "warehouse": "compute",
            }
        },
    },
}
