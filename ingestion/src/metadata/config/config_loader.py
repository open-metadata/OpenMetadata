#  Licensed to the Apache Software Foundation (ASF) under one or more
#  contributor license agreements. See the NOTICE file distributed with
#  this work for additional information regarding copyright ownership.
#  The ASF licenses this file to You under the Apache License, Version 2.0
#  (the "License"); you may not use this file except in compliance with
#  the License. You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

import io
import pathlib
from expandvars import expandvars

from .common import ConfigurationError, ConfigurationMechanism
from .json import JsonConfigurationMechanism


def load_config_file(config_file: pathlib.Path) -> dict:
    if not config_file.is_file():
        raise ConfigurationError(f"Cannot open config file {config_file}")

    config_mech: ConfigurationMechanism
    if config_file.suffix in [".json"]:
        config_mech = JsonConfigurationMechanism()
    else:
        raise ConfigurationError(
            "Only json are supported. Cannot process file type {}".format(
                config_file.suffix
            )
        )

    with config_file.open() as raw_config_fp:
        raw_config_file = raw_config_fp.read()

    expanded_config_file = expandvars(raw_config_file, nounset=True)
    config_fp = io.StringIO(expanded_config_file)
    config = config_mech.load_config(config_fp)

    return config
