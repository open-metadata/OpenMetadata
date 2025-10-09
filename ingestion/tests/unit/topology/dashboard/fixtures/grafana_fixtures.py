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
Grafana test fixtures for comprehensive testing
"""

# Sample API responses that can be used in tests

FOLDERS_API_RESPONSE = [
    {
        "id": 1,
        "uid": "nErXDvCkzz",
        "title": "Department Metrics",
        "url": "/dashboards/f/nErXDvCkzz/department-metrics",
        "type": "dash-folder",
        "tags": [],
        "isStarred": False,
        "created": "2024-01-15T10:00:00Z",
        "updated": "2024-01-20T15:30:00Z",
        "createdBy": "admin",
        "updatedBy": "admin",
        "version": 1,
    },
    {
        "id": 2,
        "uid": "vCkzznErXD",
        "title": "Infrastructure",
        "url": "/dashboards/f/vCkzznErXD/infrastructure",
        "type": "dash-folder",
        "tags": [],
        "isStarred": False,
        "created": "2024-01-10T09:00:00Z",
        "updated": "2024-01-10T09:00:00Z",
        "createdBy": "devops@example.com",
        "updatedBy": "devops@example.com",
        "version": 1,
    },
]

SEARCH_DASHBOARDS_RESPONSE = [
    {
        "id": 163,
        "uid": "Kn6QXL5Vk",
        "title": "Sales Analytics Dashboard",
        "uri": "db/sales-analytics-dashboard",
        "url": "/d/Kn6QXL5Vk/sales-analytics-dashboard",
        "slug": "sales-analytics-dashboard",
        "type": "dash-db",
        "tags": ["sales", "revenue", "kpi"],
        "isStarred": True,
        "sortMeta": 0,
        "folderId": 1,
        "folderUid": "nErXDvCkzz",
        "folderTitle": "Department Metrics",
        "folderUrl": "/dashboards/f/nErXDvCkzz/department-metrics",
    },
    {
        "id": 164,
        "uid": "L5VkKn6QX",
        "title": "Server Monitoring",
        "uri": "db/server-monitoring",
        "url": "/d/L5VkKn6QX/server-monitoring",
        "slug": "server-monitoring",
        "type": "dash-db",
        "tags": ["infrastructure", "monitoring", "servers"],
        "isStarred": False,
        "sortMeta": 0,
        "folderId": 2,
        "folderUid": "vCkzznErXD",
        "folderTitle": "Infrastructure",
        "folderUrl": "/dashboards/f/vCkzznErXD/infrastructure",
    },
    {
        "id": 165,
        "uid": "QX5VkL6Kn",
        "title": "Application Performance",
        "uri": "db/application-performance",
        "url": "/d/QX5VkL6Kn/application-performance",
        "slug": "application-performance",
        "type": "dash-db",
        "tags": ["apm", "performance", "monitoring"],
        "isStarred": False,
        "sortMeta": 0,
        "folderId": 0,  # No folder (General)
        "folderUid": "",
        "folderTitle": "General",
        "folderUrl": "",
    },
]

DASHBOARD_DETAILS_RESPONSE = {
    "dashboard": {
        "id": 163,
        "uid": "Kn6QXL5Vk",
        "title": "Sales Analytics Dashboard",
        "tags": ["sales", "revenue", "kpi"],
        "style": "dark",
        "timezone": "browser",
        "panels": [
            {
                "id": 1,
                "gridPos": {"x": 0, "y": 0, "w": 12, "h": 8},
                "type": "graph",
                "title": "Revenue Over Time",
                "description": "Monthly revenue trends with year-over-year comparison",
                "datasource": {
                    "type": "postgres",
                    "uid": "P44A8B96022E5A01A",
                },
                "targets": [
                    {
                        "refId": "A",
                        "datasource": {
                            "type": "postgres",
                            "uid": "P44A8B96022E5A01A",
                        },
                        "rawSql": """
                            SELECT 
                                date_trunc('month', order_date) as time,
                                SUM(total_amount) as revenue
                            FROM sales.orders
                            WHERE order_date >= NOW() - INTERVAL '12 months'
                            GROUP BY 1
                            ORDER BY 1
                        """,
                        "format": "time_series",
                    }
                ],
                "options": {
                    "legend": {"displayMode": "list", "placement": "bottom"},
                },
                "transparent": False,
                "pluginVersion": "9.5.3",
            },
            {
                "id": 2,
                "gridPos": {"x": 12, "y": 0, "w": 12, "h": 8},
                "type": "table",
                "title": "Top Products by Revenue",
                "datasource": {
                    "type": "postgres",
                    "uid": "P44A8B96022E5A01A",
                },
                "targets": [
                    {
                        "refId": "A",
                        "datasource": {
                            "type": "postgres",
                            "uid": "P44A8B96022E5A01A",
                        },
                        "rawSql": """
                            SELECT 
                                p.product_name,
                                p.category,
                                COUNT(DISTINCT o.order_id) as orders,
                                SUM(oi.quantity) as units_sold,
                                SUM(oi.quantity * oi.unit_price) as revenue
                            FROM sales.order_items oi
                            JOIN sales.products p ON oi.product_id = p.product_id
                            JOIN sales.orders o ON oi.order_id = o.order_id
                            WHERE o.order_date >= NOW() - INTERVAL '30 days'
                            GROUP BY 1, 2
                            ORDER BY revenue DESC
                            LIMIT 20
                        """,
                        "format": "table",
                    }
                ],
                "options": {
                    "showHeader": True,
                    "sortBy": [{"displayName": "revenue", "desc": True}],
                },
                "pluginVersion": "9.5.3",
            },
            {
                "id": 3,
                "gridPos": {"x": 0, "y": 8, "w": 8, "h": 6},
                "type": "stat",
                "title": "Total Revenue (30d)",
                "datasource": {
                    "type": "postgres",
                    "uid": "P44A8B96022E5A01A",
                },
                "targets": [
                    {
                        "refId": "A",
                        "datasource": {
                            "type": "postgres",
                            "uid": "P44A8B96022E5A01A",
                        },
                        "rawSql": """
                            SELECT SUM(total_amount) as value
                            FROM sales.orders
                            WHERE order_date >= NOW() - INTERVAL '30 days'
                        """,
                        "format": "table",
                    }
                ],
                "options": {
                    "reduceOptions": {
                        "values": False,
                        "calcs": ["lastNotNull"],
                    },
                    "text": {"valueSize": 38},
                    "colorMode": "value",
                    "graphMode": "area",
                    "justifyMode": "auto",
                },
                "pluginVersion": "9.5.3",
            },
            {
                "id": 4,
                "gridPos": {"x": 8, "y": 8, "w": 8, "h": 6},
                "type": "gauge",
                "title": "Conversion Rate",
                "datasource": {
                    "type": "prometheus",
                    "uid": "PBFA97CFc590B2093",
                },
                "targets": [
                    {
                        "refId": "A",
                        "datasource": {
                            "type": "prometheus",
                            "uid": "PBFA97CFc590B2093",
                        },
                        "expr": "rate(sales_conversions_total[5m]) / rate(sales_visits_total[5m]) * 100",
                        "format": "time_series",
                        "intervalFactor": 1,
                    }
                ],
                "options": {
                    "showThresholdLabels": False,
                    "showThresholdMarkers": True,
                },
                "pluginVersion": "9.5.3",
            },
            {
                "id": 5,
                "gridPos": {"x": 16, "y": 8, "w": 8, "h": 6},
                "type": "piechart",
                "title": "Revenue by Category",
                "datasource": {
                    "type": "mysql",
                    "uid": "M96A8BP445022E5A01",
                },
                "targets": [
                    {
                        "refId": "A",
                        "datasource": {
                            "type": "mysql",
                            "uid": "M96A8BP445022E5A01",
                        },
                        "rawSql": """
                            SELECT 
                                category,
                                SUM(revenue) as value
                            FROM analytics.category_revenue
                            WHERE date >= CURDATE() - INTERVAL 30 DAY
                            GROUP BY category
                        """,
                        "format": "table",
                    }
                ],
                "options": {
                    "legend": {
                        "displayMode": "table",
                        "placement": "right",
                        "values": ["value", "percent"],
                    },
                    "pieType": "pie",
                    "tooltipDisplayMode": "single",
                },
                "pluginVersion": "9.5.3",
            },
            {
                "id": 6,
                "gridPos": {"x": 0, "y": 14, "w": 24, "h": 1},
                "type": "row",
                "title": "Customer Metrics",
                "collapsed": False,
                "panels": [],
            },
            {
                "id": 7,
                "gridPos": {"x": 0, "y": 15, "w": 24, "h": 3},
                "type": "text",
                "title": "Dashboard Information",
                "options": {
                    "mode": "markdown",
                    "content": "This dashboard provides real-time sales analytics...",
                },
                "pluginVersion": "9.5.3",
            },
        ],
        "editable": True,
        "gnetId": None,
        "graphTooltip": 0,
        "links": [],
        "liveNow": False,
        "fiscalYearStartMonth": 0,
        "refresh": "5m",
        "revision": 1,
        "schemaVersion": 38,
        "time": {"from": "now-6h", "to": "now"},
        "timepicker": {},
        "weekStart": "",
        "version": 5,
        "description": "Comprehensive sales analytics dashboard showing revenue trends, top products, and conversion metrics",
    },
    "meta": {
        "type": "db",
        "canSave": True,
        "canEdit": True,
        "canAdmin": True,
        "canStar": True,
        "canDelete": True,
        "slug": "sales-analytics-dashboard",
        "url": "/d/Kn6QXL5Vk/sales-analytics-dashboard",
        "expires": "0001-01-01T00:00:00Z",
        "created": "2024-01-15T10:30:00Z",
        "updated": "2024-02-01T14:20:00Z",
        "updatedBy": "admin@example.com",
        "createdBy": "analyst@example.com",
        "version": 5,
        "hasAcl": False,
        "isFolder": False,
        "folderId": 1,
        "folderUid": "nErXDvCkzz",
        "folderTitle": "Department Metrics",
        "folderUrl": "/dashboards/f/nErXDvCkzz/department-metrics",
        "provisioned": False,
        "provisionedExternalId": "",
        "annotationsPermissions": {
            "dashboard": {"canAdd": True, "canEdit": True, "canDelete": True},
            "organization": {"canAdd": True, "canEdit": True, "canDelete": True},
        },
    },
}

DATASOURCES_RESPONSE = [
    {
        "id": 1,
        "uid": "P44A8B96022E5A01A",
        "orgId": 1,
        "name": "PostgreSQL Production",
        "type": "postgres",
        "typeName": "PostgreSQL",
        "typeLogoUrl": "public/app/plugins/datasource/postgres/img/postgresql_logo.svg",
        "access": "proxy",
        "url": "postgres-prod.example.com:5432",
        "password": "",
        "user": "grafana_reader",
        "database": "sales_db",
        "basicAuth": False,
        "isDefault": True,
        "jsonData": {
            "sslmode": "require",
            "postgresVersion": 1300,
            "timescaledb": False,
        },
        "readOnly": False,
    },
    {
        "id": 2,
        "uid": "PBFA97CFc590B2093",
        "orgId": 1,
        "name": "Prometheus",
        "type": "prometheus",
        "typeName": "Prometheus",
        "typeLogoUrl": "public/app/plugins/datasource/prometheus/img/prometheus_logo.svg",
        "access": "proxy",
        "url": "http://prometheus.example.com:9090",
        "password": "",
        "user": "",
        "database": "",
        "basicAuth": False,
        "isDefault": False,
        "jsonData": {
            "httpMethod": "POST",
            "queryTimeout": "60s",
            "timeout": "60",
        },
        "readOnly": False,
    },
    {
        "id": 3,
        "uid": "M96A8BP445022E5A01",
        "orgId": 1,
        "name": "MySQL Analytics",
        "type": "mysql",
        "typeName": "MySQL",
        "typeLogoUrl": "public/app/plugins/datasource/mysql/img/mysql_logo.svg",
        "access": "proxy",
        "url": "mysql-analytics.example.com:3306",
        "password": "",
        "user": "grafana",
        "database": "analytics",
        "basicAuth": False,
        "isDefault": False,
        "jsonData": {
            "maxOpenConns": 0,
            "maxIdleConns": 2,
            "connMaxLifetime": 14400,
        },
        "readOnly": False,
    },
    {
        "id": 4,
        "uid": "E022E96A8BP445A01",
        "orgId": 1,
        "name": "Elasticsearch Logs",
        "type": "elasticsearch",
        "typeName": "Elasticsearch",
        "typeLogoUrl": "public/app/plugins/datasource/elasticsearch/img/elasticsearch.svg",
        "access": "proxy",
        "url": "http://elasticsearch.example.com:9200",
        "password": "",
        "user": "",
        "database": "[logs-]YYYY.MM.DD",
        "basicAuth": False,
        "isDefault": False,
        "jsonData": {
            "esVersion": "7.10.0",
            "includeFrozen": False,
            "logLevelField": "",
            "logMessageField": "",
            "maxConcurrentShardRequests": 5,
            "timeField": "@timestamp",
        },
        "readOnly": False,
    },
]

# Complex dashboard example with various panel types and queries
COMPLEX_DASHBOARD_RESPONSE = {
    "dashboard": {
        "id": 200,
        "uid": "advanced-analytics",
        "title": "Advanced Analytics Dashboard",
        "tags": ["analytics", "advanced", "ml"],
        "panels": [
            {
                "id": 1,
                "type": "timeseries",
                "title": "Predictions vs Actuals",
                "datasource": {"type": "postgres", "uid": "P44A8B96022E5A01A"},
                "targets": [
                    {
                        "refId": "A",
                        "rawSql": """
                            WITH predictions AS (
                                SELECT 
                                    date,
                                    predicted_value,
                                    actual_value,
                                    model_version
                                FROM ml.predictions
                                WHERE date >= NOW() - INTERVAL '7 days'
                            )
                            SELECT 
                                date as time,
                                AVG(predicted_value) as "Predicted",
                                AVG(actual_value) as "Actual"
                            FROM predictions
                            GROUP BY date
                            ORDER BY date
                        """,
                    }
                ],
            },
            {
                "id": 2,
                "type": "heatmap",
                "title": "Error Distribution Heatmap",
                "datasource": {"type": "clickhouse", "uid": "CH96A8BP445022E5"},
                "targets": [
                    {
                        "refId": "A",
                        "query": """
                            SELECT 
                                toStartOfHour(timestamp) as time,
                                error_category,
                                count() as count
                            FROM errors.application_errors
                            WHERE timestamp >= now() - INTERVAL 24 HOUR
                            GROUP BY time, error_category
                            ORDER BY time
                        """,
                    }
                ],
            },
            {
                "id": 3,
                "type": "nodeGraph",
                "title": "Service Dependencies",
                "datasource": {"type": "tempo", "uid": "TEMPO8BP445022E5"},
                "targets": [
                    {
                        "refId": "A",
                        "queryType": "serviceMap",
                    }
                ],
            },
            {
                "id": 4,
                "type": "geomap",
                "title": "User Distribution Map",
                "datasource": {"type": "elasticsearch", "uid": "E022E96A8BP445A01"},
                "targets": [
                    {
                        "refId": "A",
                        "query": '{"query": "user_location:*", "aggregations": {"geo": {"geohash_grid": {"field": "location", "precision": 5}}}}',
                    }
                ],
            },
        ],
        "version": 10,
    },
    "meta": {
        "type": "db",
        "canSave": True,
        "canEdit": True,
        "canAdmin": True,
        "canStar": True,
        "canDelete": True,
        "slug": "advanced-analytics-dashboard",
        "url": "/d/advanced-analytics/advanced-analytics-dashboard",
        "created": "2024-02-01T00:00:00Z",
        "updated": "2024-02-15T00:00:00Z",
        "updatedBy": "data-team@example.com",
        "createdBy": "data-team@example.com",
        "version": 10,
        "hasAcl": False,
        "isFolder": False,
        "folderId": 0,
        "folderUid": "",
        "folderTitle": "General",
        "folderUrl": "",
    },
}
