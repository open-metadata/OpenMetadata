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
Announce method deprecation
"""
import logging
from functools import wraps

from metadata.utils.logger import METADATA_LOGGER


def deprecated(message: str, release: str):
    """Decorator factory to accept specific messages for each function"""

    def _deprecated(fn):
        @wraps(fn)
        def inner(*args, **kwargs):
            # Get the metadata logger
            logger = logging.getLogger(METADATA_LOGGER)
            # Log deprecation warning using the logging system
            # This will respect the loggerLevel configuration
            logger.warning(
                f"[{fn.__name__}] will be deprecated in the release [{release}]: {message}"
            )

            return fn(*args, **kwargs)

        return inner

    return _deprecated
