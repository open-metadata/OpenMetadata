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
Ssrs integration tests
"""
import pytest


class TestSsrsMetadata:
    @pytest.mark.integration
    def test_connection(self, ssrs_service):
        """Test that a connection can be established."""
        pass

    @pytest.mark.integration
    def test_metadata_extraction(self, ssrs_service):
        """Test that metadata can be extracted."""
        pass
