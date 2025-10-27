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

import logging
from io import StringIO
from unittest import TestCase

from metadata.utils.deprecation import deprecated
from metadata.utils.logger import set_loggers_level


class TestDeprecationWarning(TestCase):
    """Test deprecation warnings are properly displayed"""

    @deprecated(message="This is a deprecation", release="x.y.z")
    def deprecated_call(self) -> None:
        """Sample method"""

    def test_deprecation_warning(self) -> None:
        """Test that deprecation warnings are controlled by logger level."""
        logger_levels = [
            logging.DEBUG,
            logging.INFO,
            logging.WARN,
            logging.ERROR,
        ]
        log_counts = []

        for level in logger_levels:
            # Set logger level
            set_loggers_level(level)

            # Capture logging output
            log_capture = StringIO()
            handler = logging.StreamHandler(log_capture)
            metadata_logger = logging.getLogger("metadata")
            metadata_logger.addHandler(handler)

            # Create and call a deprecated function
            @deprecated("This is a test deprecated function", "1.5.0")
            def test_deprecated_function():
                return "deprecated_function_result"

            result = test_deprecated_function()
            self.assertEqual(result, "deprecated_function_result")

            # Count deprecation log messages
            log_output = log_capture.getvalue()
            log_lines = [
                line for line in log_output.split("\n") if "will be deprecated" in line
            ]
            log_counts.append(len(log_lines))

            # Clean up
            metadata_logger.removeHandler(handler)

        # ERROR level should suppress deprecation warnings, others should show them
        expected_logs = [
            1,
            1,
            1,
            0,
        ]  # DEBUG, INFO, WARN show warnings, ERROR suppresses them

        self.assertEqual(
            log_counts,
            expected_logs,
            f"Expected {expected_logs} deprecation warnings for each level, got: {log_counts}",
        )
