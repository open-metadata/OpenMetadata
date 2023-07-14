import sys
import warnings

import metadata.ometa  # nopycln: import

warnings.warn(
    "Please, import the `ometa` module from `metadata.ometa` instead of `openmetadata.ingestion.ometa`,"
    " it will be deprecated in the Release 1.2. `metadata.ometa` is now part of the package"
    " `openmetadata-ingestion-core`, which only contains the schemas and OpenMetadata client."
)

sys.modules["metadata.ingestion.ometa"] = sys.modules["metadata.ometa"]
