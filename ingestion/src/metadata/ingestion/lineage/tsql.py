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
T-SQL ALTER TABLE ... SWITCH statements, which no SQL parser we use understands.

A SWITCH moves the rows of one table into another, so for lineage it is read as
INSERT INTO <to> SELECT * FROM <switched>. Statements are matched on a masked copy of
the code, so SWITCH text inside a string, a comment or a quoted name is never taken
for a statement, and then cut out of the original by position.
"""

import re
from collections.abc import Iterator

_TSQL_NAME_PART = r'(?:\[(?:[^\]]|\]\])+\]|"(?:[^"]|"")+"|[\w@#$]+)'
_TSQL_TABLE_NAME = rf"{_TSQL_NAME_PART}(?:\s*\.\s*{_TSQL_NAME_PART}){{0,3}}"
_TSQL_PARTITION = r"PARTITION\s+(?:\$PARTITION\s*\.\s*[\w\[\]]+\s*\([^()]*\)|[\w@]+)"

# `ALTER TABLE source SWITCH [PARTITION n] TO target [PARTITION n] [WITH (...)]`
TSQL_SWITCH_STATEMENT = re.compile(
    rf"\bALTER\s+TABLE\s+(?P<source>{_TSQL_TABLE_NAME})\s+SWITCH"
    rf"(?:\s+{_TSQL_PARTITION})?\s+TO\s+(?P<target>{_TSQL_TABLE_NAME})"
    rf"(?:\s+{_TSQL_PARTITION})?(?:\s+WITH\s*\((?:[^()]|\([^()]*\))*\))?",
    re.IGNORECASE,
)


def _closing_quote(code: str, start: int, close: str) -> int:
    """Index of the quote closing the one at `start`, past doubled escapes; len(code) if unclosed"""
    index = start + 1
    while index < len(code):
        if code[index] == close:
            if code.startswith(close * 2, index):
                index += 2
                continue
            return index
        index += 1
    return len(code)


def _block_comment_end(code: str, start: int) -> int:
    """End of the block comment opening at `start`; T-SQL block comments nest"""
    depth, index = 1, start + 2
    while index < len(code) and depth:
        if code.startswith("/*", index):
            depth, index = depth + 1, index + 2
        elif code.startswith("*/", index):
            depth, index = depth - 1, index + 2
        else:
            index += 1
    return index


def mask_tsql(code: str) -> str:
    """
    The code with the same length and positions, its comments and string literals blanked
    and the inside of its quoted names filled with `_`, so a quoted name still reads as a name.
    """
    masked = list(code)
    index = 0
    while index < len(code):
        char = code[index]
        if code.startswith("--", index):
            end = code.find("\n", index)
            end = len(code) if end == -1 else end
            masked[index:end] = " " * (end - index)
        elif code.startswith("/*", index):
            end = _block_comment_end(code, index)
            masked[index:end] = " " * (end - index)
        elif char in "'[\"":
            close = _closing_quote(code, index, "]" if char == "[" else char)
            end = min(close + 1, len(code))
            if char == "'":
                masked[index:end] = " " * (end - index)
            else:
                masked[index + 1 : close] = "_" * (close - index - 1)
        else:
            end = index + 1
        index = end
    return "".join(masked)


def _switch_statements(code: str) -> Iterator[re.Match]:
    return TSQL_SWITCH_STATEMENT.finditer(mask_tsql(code))


def extract_switch_statements(code: str | None) -> list[str]:
    """The SWITCH statements of the code, as written, in order and each once"""
    code = code or ""
    return list(dict.fromkeys(code[switch.start() : switch.end()] for switch in _switch_statements(code)))


def rewrite_switch_statements(code: str) -> str:
    """The code with each SWITCH statement replaced by the INSERT ... SELECT it amounts to"""
    rewritten, last = [], 0
    for switch in _switch_statements(code):
        source = code[switch.start("source") : switch.end("source")]
        target = code[switch.start("target") : switch.end("target")]
        rewritten.append(f"{code[last : switch.start()]}INSERT INTO {target} SELECT * FROM {source}")
        last = switch.end()
    return "".join(rewritten) + code[last:]
