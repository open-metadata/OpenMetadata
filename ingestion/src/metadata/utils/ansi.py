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
Module handles the ENUM for terminal output
"""


from enum import Enum
from typing import Optional


class ANSI(Enum):
    BRIGHT_RED = "\u001b[31;1m"
    BOLD = "\u001b[1m"
    BRIGHT_CYAN = "\u001b[36;1m"
    YELLOW = "\u001b[33;1m"
    GREEN = "\u001b[32;1m"
    ENDC = "\033[0m"
    BLUE = "\u001b[34;1m"
    MAGENTA = "\u001b[35;1m"


def print_ansi_encoded_string(
    color: Optional[ANSI] = None, bold: bool = False, message: str = ""
):
    print(  # pylint: disable=print-call
        f"{ANSI.BOLD.value if bold else ''}{color.value if color else ''}{message}{ANSI.ENDC.value}"
    )
