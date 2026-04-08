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
Resolves a database service name from an OpenLineage dataset namespace.

OpenLineage dataset namespaces carry the data store type in the URL scheme
(e.g. ``mysql://host:3306/db``, ``redshift://cluster:5439/db``).  This module
uses that scheme to narrow lineage table lookups to services of the matching
type, eliminating false matches when the same table name exists in multiple
services.

Resolution order (per namespace):
1. Explicit ``namespaceToServiceMapping`` config — exact then prefix match.
2. Scheme-based auto-discovery — if exactly one configured DB service has the
   matching type, use it.  If multiple match, log a warning and fall back.
3. Caller falls back to existing suffix search across all ``dbServiceNames``.
"""

from typing import Dict, List, Optional
from urllib.parse import urlparse

from metadata.generated.schema.entity.services.databaseService import (
    DatabaseServiceType,
)
from metadata.utils.logger import ingestion_logger

logger = ingestion_logger()

# Maps OpenLineage dataset namespace URI schemes to OMD DatabaseServiceType.
# See: https://openlineage.io/docs/spec/naming/
NAMESPACE_SCHEME_TO_SERVICE_TYPE: Dict[str, DatabaseServiceType] = {
    "awsathena": DatabaseServiceType.Athena,
    "bigquery": DatabaseServiceType.BigQuery,
    "cassandra": DatabaseServiceType.Cassandra,
    "db2": DatabaseServiceType.Db2,
    "hive": DatabaseServiceType.Hive,
    "mssql": DatabaseServiceType.Mssql,
    "mysql": DatabaseServiceType.Mysql,
    "oracle": DatabaseServiceType.Oracle,
    "postgres": DatabaseServiceType.Postgres,
    "redshift": DatabaseServiceType.Redshift,
    "snowflake": DatabaseServiceType.Snowflake,
    "sqlserver": DatabaseServiceType.Synapse,
    "teradata": DatabaseServiceType.Teradata,
    "trino": DatabaseServiceType.Trino,
}


def extract_db_scheme_from_namespace(namespace: str) -> Optional[str]:
    """
    Extract the URL scheme from an OpenLineage dataset namespace.

    >>> extract_db_scheme_from_namespace("mysql://host:3306/db")
    'mysql'
    >>> extract_db_scheme_from_namespace("redshift://cluster:5439/db")
    'redshift'
    >>> extract_db_scheme_from_namespace("airflow")
    None
    """
    try:
        scheme = urlparse(namespace).scheme
        return scheme.lower() if scheme else None
    except Exception:
        return None


def find_service_by_namespace_mapping(
    namespace: str,
    mapping: Dict[str, str],
) -> Optional[str]:
    """
    Look up a database service name from a user-configured
    ``namespaceToServiceMapping`` dict (namespace-prefix → OMD service name).

    Resolution order:
    1. Exact match — ``mapping[namespace]``
    2. Prefix match — namespace starts with a mapping key.
       When multiple keys match, the longest key wins.

    Example mapping::

        {
            "mysql://cluster-a:3306": "mysql-cluster-a",
            "mysql://cluster-a:3306/specific_db": "mysql-specific",
        }

    With namespace ``"mysql://cluster-a:3306/specific_db/table"``
    → returns ``"mysql-specific"`` (longest prefix match).

    Returns the mapped service name, or ``None`` if no entry matches.
    """
    if not namespace or not mapping:
        return None

    if namespace in mapping:
        return mapping[namespace]

    # Prefix match: namespace starts with a mapping key.
    # Pick the longest matching key to avoid ambiguity.
    best_key = ""
    best_service = None
    for key, service_name in mapping.items():
        if namespace.startswith(key) and len(key) > len(best_key):
            best_key = key
            best_service = service_name

    return best_service


def find_services_by_scheme(
    scheme: str,
    db_service_type_map: Dict[str, DatabaseServiceType],
) -> List[str]:
    """
    Filter a pre-built ``{service_name: DatabaseServiceType}`` map to only
    those whose type matches the given URL scheme.

    If the scheme is recognized (present in ``NAMESPACE_SCHEME_TO_SERVICE_TYPE``),
    returns only services of that exact type.

    If the scheme is **not** recognized, returns services whose
    types are *not* in the known map — i.e. custom non-standard
    services that are more likely to be the correct match.

    Returns a list of matching service names (may be empty or contain
    multiple entries when several services of the same type are configured).
    """
    target_type = NAMESPACE_SCHEME_TO_SERVICE_TYPE.get(scheme)

    if target_type:
        return [
            name
            for name, svc_type in db_service_type_map.items()
            if svc_type == target_type
        ]

    known_types = set(NAMESPACE_SCHEME_TO_SERVICE_TYPE.values())

    return [
        name
        for name, svc_type in db_service_type_map.items()
        if svc_type not in known_types
    ]
