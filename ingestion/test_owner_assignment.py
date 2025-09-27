#!/usr/bin/env python3
"""
测试脚本：验证在元数据摄取级别添加所有权分配支持

这个脚本演示了如何在摄取配置中使用新的 owner 字段来指定默认所有者。
"""

import json
import yaml
from typing import Dict, Any

def create_sample_config_with_owner() -> Dict[str, Any]:
    """
    创建一个包含 owner 字段的示例摄取配置
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
                    "owner": "data_team"  # 新增的 owner 字段
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
    创建一个包含 owner 字段的仪表板摄取配置
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
                    "owner": "analytics_team"  # 新增的 owner 字段
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
    创建一个包含 owner 字段的管道摄取配置
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
                    "owner": "data_engineering_team"  # 新增的 owner 字段
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
    创建一个包含 owner 字段的消息服务摄取配置
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
                    "owner": "streaming_team"  # 新增的 owner 字段
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
    主函数：生成示例配置文件
    """
    print("=== OpenMetadata 摄取配置示例 - 支持所有权分配 ===\n")
    
    # 生成数据库摄取配置
    db_config = create_sample_config_with_owner()
    print("1. 数据库摄取配置 (MySQL):")
    print(yaml.dump(db_config, default_flow_style=False, allow_unicode=True))
    print("\n" + "="*50 + "\n")
    
    # 生成仪表板摄取配置
    dashboard_config = create_dashboard_config_with_owner()
    print("2. 仪表板摄取配置 (Superset):")
    print(yaml.dump(dashboard_config, default_flow_style=False, allow_unicode=True))
    print("\n" + "="*50 + "\n")
    
    # 生成管道摄取配置
    pipeline_config = create_pipeline_config_with_owner()
    print("3. 管道摄取配置 (Airflow):")
    print(yaml.dump(pipeline_config, default_flow_style=False, allow_unicode=True))
    print("\n" + "="*50 + "\n")
    
    # 生成消息服务摄取配置
    messaging_config = create_messaging_config_with_owner()
    print("4. 消息服务摄取配置 (Kafka):")
    print(yaml.dump(messaging_config, default_flow_style=False, allow_unicode=True))
    print("\n" + "="*50 + "\n")
    
    print("使用说明:")
    print("- 在 sourceConfig.config 中添加 'owner' 字段")
    print("- owner 字段的值应该是已存在于 OpenMetadata 中的用户或团队名称")
    print("- 所有通过该摄取管道创建的资产将自动分配给指定的所有者")
    print("- 如果找不到指定的所有者，系统会记录警告并继续处理")
    print("- 此功能适用于所有类型的摄取源：数据库、仪表板、管道、消息服务等")

if __name__ == "__main__":
    main()
