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
File Client for PowerBi
"""
from metadata.readers.file.config_source_factory import get_reader
from metadata.readers.file.local import LocalReader
import json
import math
from functools import singledispatch
import traceback
from time import sleep
from typing import List, Optional, Tuple

import msal

from metadata.generated.schema.entity.services.connections.dashboard.powerBIConnection import (
    LocalConfig,
    PowerBIConnection,
)
from metadata.generated.schema.entity.services.connections.dashboard.powerbi.s3Config import S3Config
from metadata.ingestion.source.dashboard.powerbi.models import (
    DataModelSchema,
)
from metadata.utils.logger import utils_logger
import zipfile

logger = utils_logger()

EXTRACTED_PBIT_FILES_PATH = "/tmp/extracted_pbit_files"

@singledispatch
def get_pbit_files(config):
    """
    Single dispatch method to get the pbit files from different sources
    """

    if config:
        raise NotImplementedError(
            f"Config not implemented for type {type(config)}: {config}"
        )

@get_pbit_files.register
def _(config: S3Config):
    try:
        reader = get_reader(config.path)
        
    except Exception as exc:
        logger.debug(traceback.format_exc())
        logger.error(f"Error extracting pbit files: {exc}")


class PowerBIFileConfigException(Exception):
    """
    Raise when encountering errors while extracting pbit files
    """

# Similar inner methods with mode client. That's fine.
# pylint: disable=duplicate-code
class PowerBiFileClient:
    """
    File client for PowerBi
    """

    client: REST

    def __init__(self, config: PowerBIConnection):
        self.config = config

    def get_data_model_schema_mappings(self) -> Optional[List[DataModelSchema]]:
        """
        Get the data model schema mappings
        """
        return get_pbit_files(self.config.pbitFilesSource)


    