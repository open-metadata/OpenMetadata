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

import json
from pathlib import Path


class ConfigurationError(Exception):
    """A configuration error has happened"""


def load_config_file(config_file: Path) -> dict:
    if not config_file.is_file():
        raise ConfigurationError(f"Cannot open config file {config_file}")

    with config_file.open() as raw_config_file:
        raw_config = raw_config_file.read()

    # The config is JSON dumped by the OpenMetadata server, not a templated
    # file: expanding it here would substitute any `${VAR}` the pipeline
    # editor wrote in a free-text field with values from this host's
    # process environment.
    config = json.loads(raw_config)

    return config  # noqa: RET504
