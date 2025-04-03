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
Test deprecation warnings
"""

import warnings
from unittest import TestCase

from metadata.utils.deprecation import deprecated


class TestDeprecationWarning(TestCase):
    """Test deprecation warnings are properly displayed"""

    @deprecated(message="This is a deprecation", release="x.y.z")
    def deprecated_call(self) -> None:
        """Sample method"""

    def test_deprecation_warning(self) -> None:
        """Validate warning"""

        with warnings.catch_warnings(record=True) as warn:
            # Trigger the warning
            self.deprecated_call()

            # Verify the result
            self.assertEqual(len(warn), 1)
            self.assertTrue(issubclass(warn[0].category, DeprecationWarning))
            self.assertTrue("This is a deprecation" in str(warn[0].message))
            self.assertTrue("x.y.z" in str(warn[0].message))
