import os
import sys

import pkg_resources

version = pkg_resources.require("openmetadata-ingestion")[0].version


def get_metadata_version() -> str:
    metadata_pkg_dir = os.path.join(os.path.dirname(__file__), "..", "..")
    metadata_pkg_dir = os.path.abspath(metadata_pkg_dir)

    return "metadata {} from {} (python {})".format(
        version,
        metadata_pkg_dir,
        get_major_minor_version(),
    )


def get_major_minor_version() -> str:
    """
    Return the major-minor version of the current Python as a string, e.g.
    "3.7" or "3.10".
    """
    return "{}.{}".format(*sys.version_info)
