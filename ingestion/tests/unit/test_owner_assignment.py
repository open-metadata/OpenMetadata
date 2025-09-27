#!/usr/bin/env python3
"""
Test script: Verify ownership assignment support at metadata ingestion level

This script demonstrates how to use the new owner field in ingestion configurations to specify default owners.
"""

import json
import yaml
from typing import Dict, Any

def create_sample_config_with_owner() -> Dict[str, Any]:
    """
    Create a sample ingestion configuration with owner field
    """
    config = {
        "source": {
            "type": "mysql",
            "serviceName": "sample_mysql",
            "serviceConnection": {
                "config": {
                    "type": "Mysql",
                    "username": "root",
                    "password": "password",
                    "hostPort": "localhost:3306",
                    "database": "sample_db"
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "DatabaseMetadata",
                    "includeOwners": True,
                    "owner": "data_team"  # New owner field
                }
            }
        },
        "sink": {
            "type": "metadata-rest",
            "config": {}
        },
        "workflowConfig": {
            "openMetadataServerConfig": {
                "hostPort": "http://localhost:8585/api",
                "authProvider": "openmetadata",
                "securityConfig": {
                    "jwtToken": "your-jwt-token-here"
                }
            }
        }
    }
    return config

def create_dashboard_config_with_owner() -> Dict[str, Any]:
    """
    Create a dashboard ingestion configuration with owner field
    """
    config = {
        "source": {
            "type": "superset",
            "serviceName": "sample_superset",
            "serviceConnection": {
                "config": {
                    "type": "Superset",
                    "hostPort": "http://localhost:8088",
                    "username": "admin",
                    "password": "admin"
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "DashboardMetadata",
                    "includeOwners": True,
                    "owner": "analytics_team"  # New owner field
                }
            }
        },
        "sink": {
            "type": "metadata-rest",
            "config": {}
        },
        "workflowConfig": {
            "openMetadataServerConfig": {
                "hostPort": "http://localhost:8585/api",
                "authProvider": "openmetadata",
                "securityConfig": {
                    "jwtToken": "your-jwt-token-here"
                }
            }
        }
    }
    return config

def create_pipeline_config_with_owner() -> Dict[str, Any]:
    """
    Create a pipeline ingestion configuration with owner field
    """
    config = {
        "source": {
            "type": "airflow",
            "serviceName": "sample_airflow",
            "serviceConnection": {
                "config": {
                    "type": "Airflow",
                    "hostPort": "http://localhost:8080",
                    "connection": {
                        "type": "Postgres",
                        "username": "airflow",
                        "password": "airflow",
                        "hostPort": "localhost:5432",
                        "database": "airflow"
                    }
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "PipelineMetadata",
                    "includeOwners": True,
                    "owner": "data_engineering_team"  # New owner field
                }
            }
        },
        "sink": {
            "type": "metadata-rest",
            "config": {}
        },
        "workflowConfig": {
            "openMetadataServerConfig": {
                "hostPort": "http://localhost:8585/api",
                "authProvider": "openmetadata",
                "securityConfig": {
                    "jwtToken": "your-jwt-token-here"
                }
            }
        }
    }
    return config

def create_messaging_config_with_owner() -> Dict[str, Any]:
    """
    Create a messaging service ingestion configuration with owner field
    """
    config = {
        "source": {
            "type": "kafka",
            "serviceName": "sample_kafka",
            "serviceConnection": {
                "config": {
                    "type": "Kafka",
                    "bootstrapServers": "localhost:9092",
                    "schemaRegistryURL": "http://localhost:8081"
                }
            },
            "sourceConfig": {
                "config": {
                    "type": "MessagingMetadata",
                    "includeOwners": True,
                    "owner": "streaming_team"  # New owner field
                }
            }
        },
        "sink": {
            "type": "metadata-rest",
            "config": {}
        },
        "workflowConfig": {
            "openMetadataServerConfig": {
                "hostPort": "http://localhost:8585/api",
                "authProvider": "openmetadata",
                "securityConfig": {
                    "jwtToken": "your-jwt-token-here"
                }
            }
        }
    }
    return config

def main():
    """
    Main function: Generate example configuration files
    """
    print("=== OpenMetadata Ingestion Configuration Examples - Ownership Assignment Support ===\n")
    
    # Generate database ingestion configuration
    db_config = create_sample_config_with_owner()
    print("1. Database Ingestion Configuration (MySQL):")
    print(yaml.dump(db_config, default_flow_style=False, allow_unicode=True))
    print("\n" + "="*50 + "\n")
    
    # Generate dashboard ingestion configuration
    dashboard_config = create_dashboard_config_with_owner()
    print("2. Dashboard Ingestion Configuration (Superset):")
    print(yaml.dump(dashboard_config, default_flow_style=False, allow_unicode=True))
    print("\n" + "="*50 + "\n")
    
    # Generate pipeline ingestion configuration
    pipeline_config = create_pipeline_config_with_owner()
    print("3. Pipeline Ingestion Configuration (Airflow):")
    print(yaml.dump(pipeline_config, default_flow_style=False, allow_unicode=True))
    print("\n" + "="*50 + "\n")
    
    # Generate messaging service ingestion configuration
    messaging_config = create_messaging_config_with_owner()
    print("4. Messaging Service Ingestion Configuration (Kafka):")
    print(yaml.dump(messaging_config, default_flow_style=False, allow_unicode=True))
    print("\n" + "="*50 + "\n")
    
    print("Usage Instructions:")
    print("- Add 'owner' field to sourceConfig.config")
    print("- The owner field value should be a user or team name that already exists in OpenMetadata")
    print("- All assets created through this ingestion pipeline will be automatically assigned to the specified owner")
    print("- If the specified owner is not found, the system will log a warning and continue processing")
    print("- This feature applies to all types of ingestion sources: databases, dashboards, pipelines, messaging services, etc.")

if __name__ == "__main__":
    main()
