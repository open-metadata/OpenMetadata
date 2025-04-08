#  Copyright 2022 Collate
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
Custom pylint plugin to catch `print` calls
"""
from typing import TYPE_CHECKING

from astroid import nodes
from pylint.checkers import BaseChecker
from pylint.checkers.utils import only_required_for_messages

if TYPE_CHECKING:
    from pylint.lint import PyLinter


class PrintChecker(BaseChecker):
    """
    Check for any print statement in the code
    """

    name = "no_print_allowed"
    _symbol = "print-call"
    msgs = {
        "W5001": (
            "Used builtin function %s",
            _symbol,
            "Print can make us lose traceability, use logging instead",
        )
    }

    @only_required_for_messages("print-call")
    def visit_call(self, node: nodes.Call) -> None:
        if isinstance(node.func, nodes.Name) and node.func.name == "print":
            self.add_message(self._symbol, node=node)


def register(linter: "PyLinter") -> None:
    """
    This required method auto registers the checker during initialization.
    :param linter: The linter to register the checker to.
    """
    linter.register_checker(PrintChecker(linter))
