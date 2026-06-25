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
"""Tag and Classification domain utilities."""

# pyright: reportImportCycles=false
# The classes here type-hint and call the OpenMetadata client, whose transitive
# imports loop back to this package
# (ometa_api -> topology -> database_service -> metadata.domain.tags). The cycle is
# runtime-safe: topology imports database_service lazily and fqn imports OpenMetadata
# only under TYPE_CHECKING. Every other module in the chain is already excluded from
# basedpyright (see [tool.basedpyright].ignore), so suppress the rule here to keep the
# rest of this package type-checked.

from metadata.domain.tags.canonicalizer import Canonical, TagCanonicalizer
from metadata.domain.tags.registry import ScopeAlreadyClearedError, TagRegistry

__all__ = [
    "Canonical",
    "ScopeAlreadyClearedError",
    "TagCanonicalizer",
    "TagRegistry",
]
