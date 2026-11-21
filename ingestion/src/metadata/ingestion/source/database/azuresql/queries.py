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
SQL Queries used during ingestion
"""

# Azure SQL Database (the single-database tier) rejects three-part names such as
# `master.sys.databases` with error 40515 ("Reference to database and/or server
# name in 'master.sys.databases' is not supported in this version of SQL Server").
# SQL Server and Azure SQL Managed Instance accept the `master.` prefix, but the
# in-context `sys.databases` form works on every tier, so it is the one we use.
AZURE_SQL_GET_DATABASES = "SELECT name FROM sys.databases order by name"
