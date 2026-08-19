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
"""MSSQL synonym discovery unit tests"""

from metadata.ingestion.source.database.mssql.models import (
    MssqlSynonym,
    MssqlSynonymTarget,
    SynonymUnresolvedReason,
)
from metadata.ingestion.source.database.mssql.queries import MSSQL_GET_SYNONYMS


def test_synonym_query_targets_a_named_database():
    rendered = MSSQL_GET_SYNONYMS.format(database_name="analytics_core")

    assert "[analytics_core].sys.synonyms" in rendered
    assert "base_object_name" in rendered


def test_synonym_model_fields():
    synonym = MssqlSynonym(
        synonym_schema="dbo",
        synonym_name="orders",
        base_object_name="[analytics_master].[dbo].[orders]",
    )

    assert synonym.synonym_schema == "dbo"
    assert synonym.base_object_name == "[analytics_master].[dbo].[orders]"


def test_unresolved_reason_values():
    assert SynonymUnresolvedReason.REMOTE_TARGET_UNMAPPED.value == "RemoteTargetUnmapped"
    assert SynonymUnresolvedReason.UNSUPPORTED_TARGET_TYPE.value == "UnsupportedTargetType"
    assert SynonymUnresolvedReason.UNRESOLVED.value == "Unresolved"


def test_synonym_target_fields():
    target = MssqlSynonymTarget(database="analytics_master", schema_name="dbo", table="orders")

    assert (target.database, target.schema_name, target.table) == ("analytics_master", "dbo", "orders")
