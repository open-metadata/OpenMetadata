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
LookML Link handler
"""
from urllib.parse import unquote, urlparse


def get_path_from_link(link: str) -> str:
    """
    Given the `lookml_link` property from an explore,
    get the source file path to fetch the file from Git.

    Note that we cannot directly use the `source_file`
    property since it does not give us the actual path,
    only the file name.

    The usual shape will be:
    /projects/<projectId>/files/<path>?params
    """
    parsed = urlparse(unquote(link))
    return parsed.path.split("/files/")[-1]
