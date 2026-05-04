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
Logging filters for Databricks SQL connector noise.
"""

import logging

_DATABRICKS_SESSION_LOGGER = "databricks.sql.session"
_DEPRECATED_PARAM_FRAGMENT = "_user_agent_entry"
_FILTER_INSTALLED_FLAG = "_om_user_agent_entry_filter_installed"


class _UserAgentEntryDeprecationFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:
            return True
        return _DEPRECATED_PARAM_FRAGMENT not in message


def suppress_user_agent_entry_deprecation_log() -> None:
    """
    Drop the `_user_agent_entry` deprecation log emitted by databricks-sqlalchemy
    without changing the level of the `databricks.sql.session` logger, so
    user-configured logging is preserved and other records flow through normally.
    Idempotent: safe to call from multiple connector modules at import time.
    """
    target_logger = logging.getLogger(_DATABRICKS_SESSION_LOGGER)
    if getattr(target_logger, _FILTER_INSTALLED_FLAG, False):
        return
    target_logger.addFilter(_UserAgentEntryDeprecationFilter())
    setattr(target_logger, _FILTER_INSTALLED_FLAG, True)
