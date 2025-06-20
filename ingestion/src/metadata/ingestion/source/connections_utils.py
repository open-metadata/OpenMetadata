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

import traceback

from sqlalchemy.engine import Engine

from metadata.utils.logger import cli_logger

logger = cli_logger()


def kill_active_connections(engine: Engine):
    """
    Method to kill the active connections
    as well as idle connections in the engine
    """
    try:
        active_conn = engine.pool.checkedout() + engine.pool.checkedin()
        if active_conn:
            engine.dispose()
    except Exception as exc:
        logger.warning(f"Error Killing the active connections {exc}")
        logger.debug(traceback.format_exc())
