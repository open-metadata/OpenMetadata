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
Test suite for the custom import checker pylint plugin
"""
import tempfile
import textwrap

from astroid import nodes, parse
from pylint import lint
from pylint.reporters import BaseReporter
from pylint.testutils import UnittestLinter

from ingestion.plugins.import_checker import ImportChecker


class TestReporter(BaseReporter):
    """Custom reporter for testing that collects messages."""

    def __init__(self):
        super().__init__()
        self.messages = []

    def handle_message(self, msg):
        self.messages.append(msg)

    def _display(self, layout):
        pass


class TestImportChecker:
    """Test cases for the ImportChecker"""

    def setup_method(self):
        """Set up test cases."""
        self.linter = UnittestLinter()
        self.checker = ImportChecker(self.linter)

    def _find_import_nodes(self, ast_node):
        """Find all import and importfrom nodes in the AST."""
        import_nodes = []
        importfrom_nodes = []

        for node in ast_node.nodes_of_class((nodes.Import, nodes.ImportFrom)):
            if isinstance(node, nodes.Import):
                import_nodes.append(node)
            else:
                importfrom_nodes.append(node)

        return import_nodes, importfrom_nodes

    def test_valid_imports(self):
        """Test that valid imports don't trigger warnings."""
        test_code = """
        import metadata.something
        from metadata import something
        from metadata.something import other
        """
        ast_node = parse(test_code)
        import_nodes, importfrom_nodes = self._find_import_nodes(ast_node)

        for node in import_nodes:
            self.checker.visit_import(node)
        for node in importfrom_nodes:
            self.checker.visit_importfrom(node)

        assert not self.linter.release_messages()

    def test_invalid_direct_import(self):
        """Test that direct ingestion.src.metadata imports trigger warnings."""
        test_code = """
        import ingestion.src.metadata.something
        """
        ast_node = parse(test_code)
        import_nodes, _ = self._find_import_nodes(ast_node)

        for node in import_nodes:
            self.checker.visit_import(node)

        messages = self.linter.release_messages()
        assert len(messages) == 1
        assert messages[0].msg_id == "ingestion-src-import"

    def test_invalid_from_import(self):
        """Test that from ingestion.src.metadata imports trigger warnings."""
        test_code = """
        from ingestion.src.metadata import something
        """
        ast_node = parse(test_code)
        _, importfrom_nodes = self._find_import_nodes(ast_node)

        for node in importfrom_nodes:
            self.checker.visit_importfrom(node)

        messages = self.linter.release_messages()
        assert len(messages) == 1
        assert messages[0].msg_id == "ingestion-src-import"

    def test_multiple_invalid_imports(self):
        """Test that multiple invalid imports trigger multiple warnings."""
        test_code = """
        import ingestion.src.metadata.something
        from ingestion.src.metadata import other
        import ingestion.src.metadata.another
        """
        ast_node = parse(test_code)
        import_nodes, importfrom_nodes = self._find_import_nodes(ast_node)

        for node in import_nodes:
            self.checker.visit_import(node)
        for node in importfrom_nodes:
            self.checker.visit_importfrom(node)

        messages = self.linter.release_messages()
        assert len(messages) == 3
        assert all(msg.msg_id == "ingestion-src-import" for msg in messages)

    def test_real_file_check(self):
        """Test the checker on actual files."""
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".py", delete=False
        ) as temp_file:
            temp_file.write(
                textwrap.dedent(
                    """
            from metadata import valid_import
            import ingestion.src.metadata.something
            from ingestion.src.metadata import another_thing
            """
                )
            )
            temp_file.flush()

            reporter = TestReporter()
            lint.Run(
                ["--load-plugins=ingestion.plugins.import_checker", temp_file.name],
                reporter=reporter,
                exit=False,
            )
            messages = reporter.messages
            import_err_msg = [
                msg for msg in messages if msg.symbol == "ingestion-src-import"
            ]
            assert len(import_err_msg) == 2
            assert all(msg.symbol == "ingestion-src-import" for msg in import_err_msg)
