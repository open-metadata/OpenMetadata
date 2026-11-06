# Derived from https://github.com/TIKI-Institut/openmetadata-dremio-connector
# Copyright TIKI GmbH, licensed under the Apache License, Version 2.0.
# The queries below up to DREMIO_GET_VIEWS come from that project; the
# test-connection queries that follow were added for OpenMetadata.

"""
SQL queries used by the Dremio connector.

Dremio exposes spaces, sources and folders as schemas whose names are dotted
paths: `<space>.<folder>(.<folder>)`. A top-level name is a database for
OpenMetadata, and the remainder of the path is its schema.
"""

import textwrap

# `INFORMATION_SCHEMA` and `sys` are Dremio's own catalogs, present in every
# project: they hold no user data and are not ingested as databases.
DREMIO_GET_DATABASES = textwrap.dedent(
    """
SELECT SCHEMA_NAME
FROM INFORMATION_SCHEMA.SCHEMATA
WHERE SCHEMA_NAME NOT LIKE '%.%'
  AND NOT STARTS_WITH(SCHEMA_NAME, '@')
  AND NOT STARTS_WITH(SCHEMA_NAME, '$')
  AND UPPER(SCHEMA_NAME) NOT IN ('INFORMATION_SCHEMA', 'SYS')
    """
)

# The folders of a namespace, and the namespace itself when objects sit at its
# root, which is where Dremio puts them in a space that has no folder.
# STARTS_WITH, because `_` is a wildcard of LIKE and namespaces have underscores.
DREMIO_GET_SCHEMAS = textwrap.dedent(
    """
SELECT SCHEMA_NAME
FROM INFORMATION_SCHEMA.SCHEMATA
WHERE STARTS_WITH(SCHEMA_NAME, '{database_name}.')
UNION
SELECT DISTINCT TABLE_SCHEMA
FROM INFORMATION_SCHEMA."TABLES"
WHERE TABLE_SCHEMA = '{database_name}'
    """
)


DREMIO_GET_TABLES = textwrap.dedent(
    """
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA."TABLES"
WHERE TABLE_SCHEMA  = '{schema_name}'
AND TABLE_TYPE = 'TABLE'
    """
)

DREMIO_GET_VIEWS = textwrap.dedent(
    """
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA."TABLES"
WHERE TABLE_SCHEMA  = '{schema_name}'
AND TABLE_TYPE = 'VIEW'
    """
)


# Test connection
DREMIO_TEST_GET_SCHEMAS = textwrap.dedent(
    """
SELECT SCHEMA_NAME
FROM INFORMATION_SCHEMA.SCHEMATA
    """
)

# `TABLE_SCHEMA <> 'INFORMATION_SCHEMA'` keeps the check on user datasets and
# off the system catalog that Dremio always exposes.
DREMIO_TEST_GET_TABLES = textwrap.dedent(
    """
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA."TABLES"
WHERE TABLE_TYPE IN ('TABLE', 'VIEW')
  AND TABLE_SCHEMA <> 'INFORMATION_SCHEMA'
    """
)

# The job history lives in a different system table depending on the edition:
# `sys.project.jobs_recent` on Dremio Cloud, `sys.jobs_recent` on Dremio
# Software. It is resolved at run time by probing these candidates in order.
# `jobs` next to them only lists the jobs that are running.
DREMIO_JOBS_TABLES = ("sys.project.jobs_recent", "sys.jobs_recent")

DREMIO_TEST_GET_JOBS = "SELECT job_id FROM {jobs_table} LIMIT 1"
