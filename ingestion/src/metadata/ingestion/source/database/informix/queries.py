#  Copyright 2026 OpenMetadata
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
Informix SQL queries.

Verified against Informix 14.10.FC9W1DE and 15.0.1.0.3. ``name`` and ``procname``
are CHAR columns, so both are TRIMmed -- an untrimmed database name becomes a
padded FQN and a second, phantom Database entity on the next ingestion run.
"""

# sysmaster is cross-referenced explicitly: the connector is attached to the
# configured database, not to sysmaster.
#
# The server's own databases are excluded. They are not empty placeholders the
# way template0/template1 are on Postgres -- sysmaster alone carries over 200
# monitoring tables and sysadmin another 50 -- so ingesting all databases would
# bury a user's handful of real ones under several hundred internal ones.
#
# Two independent tests, because neither alone is enough. sysdatabases.flags
# carries a marker the server sets on its own databases (0x20 on sysadmin,
# sysuser and sysutils; 0x8 on sysmaster), which covers system databases this
# code has never heard of -- but only if a given one carries the bit, which
# cannot be checked for features not enabled here. The name list covers the
# documented ones regardless of flags. A database has to fail both to be
# ingested.
#
# The flags decode was measured, not looked up: 0x1 is logging, 0x2 buffered
# logging, 0x4 ANSI, and databases created every one of those ways still carry
# neither 0x8 nor 0x20. Verified identically on 14.10.FC9W1DE and 15.0.1.0.3.
#
# Erring this way is deliberate. A system database that slips through is noise a
# databaseFilterPattern can remove; a user database wrongly excluded is data
# silently missing from the catalogue with nothing to indicate it.
INFORMIX_SYSTEM_DATABASES = (
    "sysmaster",
    "sysutils",
    "sysuser",
    "sysadmin",
    "syscdr",  # Enterprise Replication
    "syscdcv1",  # Change Data Capture
    "sysha",  # Connection Manager
)

INFORMIX_SYSTEM_DATABASE_FLAGS = 0x28  # 0x20 catalogue databases | 0x8 sysmaster

INFORMIX_GET_DATABASE_NAMES = f"""
SELECT TRIM(name) AS dbname
FROM sysmaster:sysdatabases
WHERE BITAND(flags, {INFORMIX_SYSTEM_DATABASE_FLAGS}) = 0
  AND TRIM(name) NOT IN ({", ".join(f"'{name}'" for name in INFORMIX_SYSTEM_DATABASES)})
ORDER BY name
"""

# FIRST 1 keeps the test-connection step cheap; sysprocedures is populated with
# built-ins on every database, so this probes privilege, not user content.
INFORMIX_TEST_GET_STORED_PROCEDURES = """
SELECT FIRST 1 TRIM(procname) AS procname
FROM sysprocedures
"""

# Two things the JDBC driver loses, both recovered here in one pass.
#
# Type: Informix reports BYTE, TEXT, CLOB and BLOB identically, as
# VARCHAR(2147483647), so the true type has to come from the catalogue or the
# catalogue records a binary column as ordinary short text.
#
# Length: the driver reports no length at all for CHAR/VARCHAR/LVARCHAR, and
# OpenMetadata then defaults every one of them to 1 -- a CHAR(10) is catalogued
# as char(1). collength carries the real width, but is encoded per type:
# VARCHAR and NVARCHAR pack an optional reserved minimum into the high byte
# (VARCHAR(50,10) is 50 + 10*256 = 2610), so those need masking, while CHAR,
# NCHAR and LVARCHAR are the plain width and must not be masked -- they are the
# only ones that legitimately exceed 255 (CHAR(300) is 300).
#
# coltype carries flags in its high bits -- NOT NULL adds 256, so BYTE NOT NULL
# arrives as 267 -- hence MOD. Code 41 is the generic opaque type and covers
# BOOLEAN as well as the smart large objects, so the subtype name in sysxtdtypes
# is what separates them; filtering on 41 alone would make every boolean column
# unprofilable.
#
# The ANSI JOIN syntax is deliberate. With Informix's older "OUTER" form a
# predicate mentioning the outer table is folded into the join instead of
# filtering, and this query silently returns every column in the schema.
INFORMIX_GET_COLUMN_TYPES = """
SELECT TRIM(t.tabname) AS tabname,
       TRIM(c.colname) AS colname,
       MOD(c.coltype, 256) AS basetype,
       c.collength AS collength,
       TRIM(x.name) AS xtype
FROM systables t
JOIN syscolumns c ON c.tabid = t.tabid
LEFT JOIN sysxtdtypes x ON x.extended_id = c.extended_id
WHERE t.owner = :owner
  AND t.tabtype IN ('T', 'V')
  AND MOD(c.coltype, 256) IN (0, 11, 12, 13, 14, 15, 16, 40, 41)
"""

# Informix reserves tabid below 100 for its own catalogue. The JDBC driver's
# view listing does not apply that rule, so sysdomains and sysindexes arrive
# looking exactly like user views -- same owner, same type -- and land in the
# catalogue as though someone had created them.
INFORMIX_GET_VIEW_NAMES = """
SELECT TRIM(tabname) AS tabname
FROM systables
WHERE owner = :owner
  AND tabtype = 'V'
  AND tabid >= 100
ORDER BY tabname
"""

# viewtext is split across rows; seqno puts it back together.
INFORMIX_GET_VIEW_DEFINITION = """
SELECT v.viewtext
FROM sysviews v
JOIN systables t ON t.tabid = v.tabid
WHERE t.tabname = :view_name
  AND t.owner = :owner
ORDER BY v.seqno
"""

# sysprocedures holds ~560 built-ins on every database, so listing it wholesale
# would bury a handful of real routines. Case in the mode column is what
# separates them: user-created routines carry an upper-case mode, Informix's own
# carry lower case. Verified by creating routines and reading them back -- on a
# stock 14.10 database the filter leaves exactly the ones a user wrote.
INFORMIX_GET_STORED_PROCEDURES = """
SELECT TRIM(p.procname) AS name,
       p.isproc AS is_proc,
       p.procid AS proc_id
FROM sysprocedures p
WHERE p.owner = :owner
  AND p.mode MATCHES '[A-Z]'
ORDER BY p.procname
"""

# datakey 'T' is the routine's own text; seqno reassembles it.
INFORMIX_GET_STORED_PROCEDURE_DEFINITION = """
SELECT data
FROM sysprocbody
WHERE procid = :proc_id
  AND datakey = 'T'
ORDER BY seqno
"""

# The JDBC driver cannot turn every Informix type into a Python value, and a
# column it cannot convert does not fail alone -- it fails the whole SELECT, so
# one such column costs the entire table its sample data. Measured against
# 14.10.FC9W1DE by selecting one column at a time:
#
#     INT, LVARCHAR, VARCHAR ....... value
#     DISTINCT type of LVARCHAR .... value          (the driver sees through it)
#     CLOB ......................... value
#     BLOB, BYTE, TEXT ............. None           (sqlalchemy-jdbcapi calls
#                                                    Blob.getBytes(long, long),
#                                                    which matches no overload)
#     ROW, SET, MULTISET, LIST ..... java.lang.Object leaks out as-is, but
#                                    ::LVARCHAR renders it -- ROW('HTML','') --
#                                    with no syscasts row to say so
#     user-defined OPAQUE .......... SQLException, and the whole query dies
#
# The large objects come back as None, which is harmless. The complex and opaque
# types are not usable as data and, in the opaque case, take every other column
# down with them.
#
# Dropping those columns is the last resort, not the first. An opaque type built
# the way Informix's own tooling builds them carries an output support function
# and, with it, a registered cast to LVARCHAR -- which is how dbaccess prints a
# value the JDBC driver refuses. Casting in the SELECT means the driver never
# sees the opaque type at all, only text, so the column keeps its data instead of
# disappearing. syscasts says per type whether that cast exists; measured on
# 14.10.FC9W1DE against the binaryudt DataBlade's binaryvar type:
#
#     SELECT payload            -> java object, or SQLException for a type the
#                                  driver has no class for
#     SELECT payload::LVARCHAR  -> '48656C6C6F'
#
# Row and collection types have no such cast, and an opaque type declared without
# support functions has none either; those are the ones actually left out.
#
# Opaque types cannot be told apart by sysxtdtypes.mode -- a type created with
# CREATE OPAQUE TYPE reports mode 'B', exactly like Informix's own. So the
# discriminator is the name: the built-in extended types the driver converts are
# a small fixed set, and anything else on a coltype 40/41 column is user-defined.
#
# A distinct type carries a name of its own but behaves as whatever it was built
# from, so the test has to run against that: CREATE DISTINCT TYPE html AS LVARCHAR
# returns a value, while the same name over an opaque type does not. sysxtdtypes
# .source points at the base, and judging the distinct type by its own name gets
# both cases wrong in opposite directions.
#
# 19, 20, 21 and 22 are SET, MULTISET, LIST and ROW. A named ROW column has
# coltype 4118, which is why every comparison here is on MOD(coltype, 256).
INFORMIX_DRIVER_CONVERTIBLE_EXTENDED_TYPES = ("lvarchar", "boolean", "blob", "clob")

INFORMIX_GET_DRIVER_UNFRIENDLY_COLUMNS = f"""
SELECT TRIM(c.colname) AS colname,
       CASE WHEN MOD(c.coltype, 256) IN (19, 20, 21, 22) THEN 1
            ELSE (SELECT COUNT(*)
                    FROM syscasts k
                    JOIN sysxtdtypes xr ON xr.extended_id = k.result_xid
                   WHERE k.argument_xid = c.extended_id
                     AND TRIM(xr.name) = 'lvarchar')
       END AS casts_to_text
FROM systables t
JOIN syscolumns c ON c.tabid = t.tabid
LEFT JOIN sysxtdtypes x ON x.extended_id = c.extended_id
LEFT JOIN sysxtdtypes b ON b.extended_id = x.source
WHERE t.tabname = :table_name
  AND t.owner = :owner
  AND ( MOD(c.coltype, 256) IN (19, 20, 21, 22)
        OR ( MOD(c.coltype, 256) IN (40, 41)
             AND LOWER(TRIM(NVL(b.name, x.name))) NOT IN
                 ({", ".join(f"'{name}'" for name in INFORMIX_DRIVER_CONVERTIBLE_EXTENDED_TYPES)}) ) )
"""
