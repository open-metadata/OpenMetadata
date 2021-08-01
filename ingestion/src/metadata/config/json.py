from typing import IO

import json
from .common import ConfigurationMechanism


class JsonConfigurationMechanism(ConfigurationMechanism):
    """Ability to load configuration from yaml files"""

    def load_config(self, config_fp: IO):
        config = json.load(config_fp)
        return config
