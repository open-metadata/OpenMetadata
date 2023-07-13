import sys
import warnings

import metadata.ometa  # nopycln: import

warnings.warn(
    "Please, import the `ometa` module from `metadata.ometa` instead of `openmetadata.ingestion.ometa`,"
    " it will be deprecated in the Release 1.2"
)

sys.modules["metadata.ingestion.ometa"] = sys.modules["metadata.ometa"]
