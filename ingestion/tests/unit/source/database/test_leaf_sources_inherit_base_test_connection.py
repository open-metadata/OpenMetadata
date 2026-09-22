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
"""Leaf database sources that own a BaseConnection must reuse it for the test
step by inheriting ``DatabaseServiceSource.test_connection`` — never a private
override that would build a second client."""

import pytest

from metadata.ingestion.source.database.database_service import DatabaseServiceSource
from metadata.ingestion.source.database.datalake.metadata import DatalakeSource
from metadata.ingestion.source.database.deltalake.metadata import DeltalakeSource
from metadata.ingestion.source.database.domodatabase.metadata import DomodatabaseSource
from metadata.ingestion.source.database.glue.metadata import GlueSource
from metadata.ingestion.source.database.salesforce.metadata import SalesforceSource
from metadata.ingestion.source.database.sas.metadata import SasSource

OWNED_LEAF_SOURCES = [
    DatalakeSource,
    DeltalakeSource,
    DomodatabaseSource,
    GlueSource,
    SalesforceSource,
    SasSource,
]


@pytest.mark.parametrize("source_cls", OWNED_LEAF_SOURCES)
def test_leaf_source_inherits_base_test_connection(source_cls):
    assert source_cls.test_connection is DatabaseServiceSource.test_connection
    assert "test_connection" not in source_cls.__dict__


@pytest.mark.parametrize("source_cls", OWNED_LEAF_SOURCES)
def test_leaf_source_releases_owner_via_base_close(source_cls):
    assert source_cls.close is DatabaseServiceSource.close
    assert "close" not in source_cls.__dict__
