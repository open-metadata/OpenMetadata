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
Teradata SQLAlchemy Helper Methods
"""

from sqlalchemy.engine import reflection

from metadata.ingestion.source.database.teradata.queries import TERADATA_TABLE_COMMENTS
from metadata.utils.logger import ingestion_logger
from metadata.utils.sqlalchemy_utils import get_table_comment_wrapper

logger = ingestion_logger()


@reflection.cache
def get_table_comment(
    self, connection, table_name, schema=None, **kw
):  # pylint: disable=unused-argument
    return get_table_comment_wrapper(
        self,
        connection,
        table_name=table_name,
        schema=schema,
        query=TERADATA_TABLE_COMMENTS,
    )
