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
Constants used by PowerBI metadata ingestion
"""

OWNER_ACCESS_RIGHTS_KEYWORDS = ["owner", "write", "admin"]

SNOWFLAKE_QUERY_EXPRESSION_KW = "Value.NativeQuery(Snowflake.Databases("
DATABRICKS_QUERY_EXPRESSION_KW = "Value.NativeQuery(Databricks.Catalogs("

DEFAULT_REPORTS_PREFIX = "reports"
RDL_REPORT_FORMAT = "RDL"
RDL_REPORTS_PREFIX = "rdlreports"

# =============================================================================
# Power BI Admin API - OData Filter Node Limit
# =============================================================================
# The 'Groups - Get Groups As Admin' API enforces a MaxNodeCount limit of 100
# for OData $filter expressions. Each filter clause consumes a certain number
# of AST (Abstract Syntax Tree) nodes, and each 'or' operator adds 1 node.
#
# Node cost per filter type:
#   - trim(name) eq '{value}'        : ~6 nodes per clause (most expensive)
#   - startswith(name, '{value}')     : ~3 nodes per clause
#   - endswith(name, '{value}')       : ~3 nodes per clause
#   - contains(name, '{value}')       : ~3 nodes per clause
#
# Formula: (nodes_per_clause × N) + (N - 1) ≤ 100
#
# Worst case at N=10 (all trim eq): 6×10 + 9 = 69 nodes (within limit)
# Best case at N=10 (all contains):  3×10 + 9 = 39 nodes (within limit)
#
# Batch size is set to 10 to safely accommodate any mix of filter types
# while staying well under the 100-node limit.
# =============================================================================

MAX_PROJECT_FILTER_SIZE = 10
