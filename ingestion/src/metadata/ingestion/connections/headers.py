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
Custom OM connection headers
"""
import json

import pkg_resources


def render_query_header(ometa_version: str) -> str:
    """
    Render the query header for OpenMetadata Queries
    """

    header_obj = {"app": "OpenMetadata", "version": ometa_version}
    return f"/* {json.dumps(header_obj)} */"


def inject_query_header(
    conn, cursor, statement, parameters, context, executemany
):  # pylint: disable=unused-argument
    """
    Inject the query header for OpenMetadata Queries
    """

    version = pkg_resources.require("openmetadata-ingestion")[0].version
    statement_with_header = render_query_header(version) + "\n" + statement
    return statement_with_header, parameters
