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
    
    print("Usage Instructions:")
    print("- Add 'owner' field to sourceConfig.config")
    print("- The owner field value should be a user or team name that already exists in OpenMetadata")
    print("- All assets created through this ingestion pipeline will be automatically assigned to the specified owner")
    print("- If the specified owner is not found, the system will log a warning and continue processing")
    print("- This feature currently supports Database and Dashboard services")
    print("- Pipeline and Messaging services are not currently supported by this feature")

if __name__ == "__main__":
    main()
