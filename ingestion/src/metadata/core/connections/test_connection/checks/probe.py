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
"""Trying several candidates until one answers.

A step that has to read one object out of many should not stake the connection on
whichever object the server listed first: a restricted login usually holds
permission on exactly the objects it ingests, so the first one refusing the read
says nothing about the rest. Athena and Glue each grew their own version of this
loop; this is the shared one.

What counts as an answer is the caller's to decide, because the connectors differ:
proving a privilege only needs the call not to raise, while proving there is data
to read needs a non-empty result. Hence the probe returns a value to accept a
target and ``None`` to keep looking.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, TypeVar

from metadata.utils.logger import ingestion_logger

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence

logger = ingestion_logger()

T = TypeVar("T")
R = TypeVar("R")


def probe_targets(targets: Sequence[T], probe: Callable[[T], R | None]) -> tuple[T, R] | None:
    """The first target ``probe`` accepts, with what it returned.

    ``probe`` returning a value accepts that target and ends the loop; returning
    ``None`` keeps looking; raising means that target refused, and the next one is
    tried. The error is re-raised only when no target answered at all - if one
    succeeded without accepting (an empty read), the outcome is "nothing accepted",
    which the caller reports, usually as a caveat.
    """
    error: Exception | None = None
    answered = False
    for target in targets:
        try:
            result = probe(target)
        except Exception as exc:
            error = exc
            logger.debug("Probe of %r failed: %s", target, exc)
        else:
            answered = True
            if result is not None:
                return target, result
    if error is not None and not answered:
        raise error
    return None
