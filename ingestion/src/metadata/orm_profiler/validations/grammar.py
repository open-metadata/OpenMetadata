#  Copyright 2021 Collate
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
Validation grammar definition.

We will use this to convert the test cases specified
in the JSON workflows to our internal metrics, profilers
and validations.

We need to parse expressions such as:
    - "row_count > 1000"
    - "qty_sold_per_day > 100"

Test definitions are going to be pointing to tables or columns.
This means that we will have that information beforehand.

The job of the grammar is to make it as easy as possible
for users to define their tests and link that logic
to the profiler objects.
"""
from typing import Dict, List

from parsimonious import NodeVisitor
from parsimonious.grammar import Grammar

# To understand the grammar definition better, read it from bottom to top.
# Line by line, we are doing:
#     1. ws: define the whitespace regex
#     2. operand: set of supported operands. Only one can match
#     3. operation: [space]operand[space] or just operand. Spaces are optional
#     4. value: what do we match in the expression. It can be any word, e.g., 100, Food, Seat500, 0.3
#               Note that we need to start checking the number. Otherwise, `would` match but leave
#               unparsed string in decimals.
#     5. metric: letters and underscores. We will match them to Metrics afterwards
grammar = Grammar(
    """
    test_def = (rule / sep)*
    
    rule       = metric operation value
    sep        = ws? "&" ws?
    metric     = ~r"[a-zA-Z_]+"
    value      = number / word
    
    word       = ~r"[-\w]+"
    number     = ~r"\d+.?(\d+)?"
    operation  = ws? operand ws? 
    operand    = "==" / "!=" / "<=" / ">=" / "<" / ">"
    
    ws         = ~"\s*"
    """
)


class ExpVisitor(NodeVisitor):
    """
    Visit the extracted nodes from our
    test expression definition
    """

    @staticmethod
    def visit_test_def(_, visited_children):
        """Returns the overall output."""

        validations = [child[0] for child in visited_children if child[0]]

        return validations

    @staticmethod
    def visit_rule(_, visited_children):
        rule = {key: value for key, value in visited_children}
        return rule

    @staticmethod
    def visit_sep(*args, **kwargs):
        pass

    @staticmethod
    def visit_metric(node, _):
        return node.expr_name, node.text

    @staticmethod
    def visit_operation(node, _):
        return node.expr_name, node.text.strip()

    @staticmethod
    def visit_value(node, _):
        return node.expr_name, node.text

    def generic_visit(self, node, visited_children):
        """
        Generic visit method. Return the children
        or the node if there are no children
        """
        return visited_children or node


def parse(expression: str, visitor: ExpVisitor) -> List[Dict[str, str]]:
    """
    Given an expression, parse it with
    our grammar and return the visiting
    result
    """
    tree = grammar.parse(expression)
    return visitor.visit(tree)
