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
Temporary file until we deprecate the `metadata.ingestion.ometa` import in 1.2.
"""
import sys
import warnings

import metadata.ometa  # nopycln: import

warnings.warn(
    "Please, import the `ometa` module from `metadata.ometa` instead of `openmetadata.ingestion.ometa`,"
    " it will be deprecated in the Release 1.2. `metadata.ometa` is now part of the package"
    " `openmetadata-ingestion-core`, which only contains the schemas and OpenMetadata client."
)

sys.modules["metadata.ingestion.ometa"] = sys.modules["metadata.ometa"]
