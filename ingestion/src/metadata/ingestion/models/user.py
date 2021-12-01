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

import copy
import json
from typing import Any, Dict, List, Optional

from metadata.ingestion.models.json_serializable import JsonSerializable

UNQUOTED_SUFFIX = ":UNQUOTED"


class MetadataOrg(JsonSerializable):
    """
    Catalog Org Model
    """

    def __init__(self, name: str, documentation: str = "") -> None:
        """ """
        self.name = name
        self.documentation = documentation


class MetadataTeam(JsonSerializable):
    """
    Catalog Team Model
    """

    def __init__(self, name: str, description: str = "") -> None:
        """ """
        self.name = name.replace(" ", "_")
        self.display_name = name
        self.description = description


class MetadataRole(JsonSerializable):
    """
    Catalog Role
    """

    def __init__(self, name: str, documentation: str = ""):
        """ """
        self.name = name
        self.documentation = documentation
