#  Copyright 2022 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

"""
Custom pylint plugin to catch `print` calls
"""
from typing import TYPE_CHECKING

import astroid
from astroid import nodes
from pylint.checkers import BaseChecker
from pylint.interfaces import IAstroidChecker

if TYPE_CHECKING:
    from pylint.lint import PyLinter


class PrintChecker(BaseChecker):
    """
    Check for any print statement in the code
    """

    __implements__ = IAstroidChecker
    _symbol = "print-call"

    name = "print_checker"
    msgs = {
        "WDE01": (
            "Use logging instead of print statements",
            _symbol,
            "Print can make us lose traceability, use logging instead",
        )
    }

    def visit_call(self, node: nodes.Call) -> None:
        """
        Process a module and check for prints
        """

        # print is a named func
        if isinstance(node.func, astroid.Name) and node.func.name == "print":
            self.add_message(
                self._symbol,
                node=node,
            )


def register(linter: "PyLinter") -> None:
    """
    This required method auto registers the checker during initialization.
    :param linter: The linter to register the checker to.
    """
    linter.register_checker(PrintChecker(linter))
