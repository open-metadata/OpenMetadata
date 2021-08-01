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
