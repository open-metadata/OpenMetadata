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
s3 utils module
"""

from collections.abc import Iterable


def list_s3_objects(client, **kwargs) -> Iterable:
    """List S3 object keys using pagination, letting botocore errors propagate.

    Previously this helper wrapped the entire generator body in a bare
    ``except Exception`` that only logged a warning and then terminated the
    generator. Because the function is a generator, the ``try`` also covered
    the ``yield``-driven pull loop: an error raised by ``paginate()`` *after*
    the first page was consumed stopped iteration, but every page already
    yielded kept its content — callers saw a truncated or empty listing and the
    workflow reported success. Mirrors
    ``metadata.ingestion.source.database.dbt.dbt_config._iter_s3_object_keys``
    which was introduced to work around this behaviour.
    """
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(**kwargs):
        yield from page.get("Contents", [])
