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
Custom pylint plugin to catch `ingest.src` imports
"""
from typing import TYPE_CHECKING

from astroid import nodes
from pylint.checkers import BaseChecker
from pylint.checkers.utils import only_required_for_messages

if TYPE_CHECKING:
    from pylint.lint import PyLinter


class ImportChecker(BaseChecker):
    """
    Check for any `ingestion.src.metadata` imports
    """

    name = "no_ingestion_src_imports"
    _symbol = "ingestion-src-import"
    msgs = {
        "W5002": (
            "Found ingestion.src.metadata import",
            _symbol,
            "`ingestion.src.metadata` imports are not allowed, use `metadata.` instead",
        )
    }

    @only_required_for_messages("ingestion-src-import")
    def visit_import(self, node: nodes.Import) -> None:
        """Check for direct imports of ingestion.src.metadata"""
        for name_tuple in node.names:
            if isinstance(name_tuple, tuple) and name_tuple[0].startswith(
                "ingestion.src.metadata"
            ):
                self.add_message(self._symbol, node=node)

    @only_required_for_messages("ingestion-src-import")
    def visit_importfrom(self, node: nodes.ImportFrom) -> None:
        """Check for from ingestion.src.metadata imports"""
        if (
            node.modname
            and isinstance(node.modname, str)
            and node.modname.startswith("ingestion.src.metadata")
        ):
            self.add_message(self._symbol, node=node)


def register(linter: "PyLinter") -> None:
    """
    This required method auto registers the checker during initialization.
    :param linter: The linter to register the checker to.
    """
    linter.register_checker(ImportChecker(linter))
