"""
Unit tests for metadata/parsers/protobuf_parser.py

Covers:
  - _resolve_message_class() — the core fix for issue #15274
  - ProtobufDataTypes enum
  - ProtobufParser._get_field_type()
  - ProtobufParser.get_protobuf_fields()
  - ProtobufParser.parse_protobuf_schema() (via mocking)
  - ProtobufParser.get_protobuf_python_object() (via mocking)
  - ProtobufParser.create_proto_files() (via mocking)

Run with:
    pytest tests/unit/test_protobuf_parser.py -v
"""

import sys
import types
from unittest.mock import MagicMock,patch,mock_open
from enum import Enum
import pytest
import grpc_tools.protoc
import os

# ---- PATH FIRST ----
sys.path.insert(0, r"F:\OpenMetadata\ingestion\src\metadata\parsers")

# ---- STUBS (minimal, single source of truth) ----

# metadata.generated.schema.entity.data.table
table_mod = types.ModuleType("metadata.generated.schema.entity.data.table")

class DataType(Enum):
    UNKNOWN = "UNKNOWN"
    INT = "INT"
    STRING = "STRING"
    BOOLEAN = "BOOLEAN"
    ENUM = "ENUM"
    RECORD = "RECORD"
    FIXED = "FIXED"

class Column:
    pass

table_mod.DataType = DataType
table_mod.Column = Column

# metadata.generated.schema.type.schema
schema_mod = types.ModuleType("metadata.generated.schema.type.schema")

class DataTypeTopic(Enum):
    FIXED = "FIXED"

class FieldModel:
    def __init__(self, name=None, children=None):
        self.name = name
        self.children = children or []
from unittest.mock import MagicMock
schema_mod.DataTypeTopic = DataTypeTopic
schema_mod.FieldModel = MagicMock()

# helpers
helpers_mod = types.ModuleType("metadata.utils.helpers")
helpers_mod.snake_to_camel = lambda x: "".join(w.title() for w in x.split("_"))

# logger
logger_mod = types.ModuleType("metadata.utils.logger")
logger_mod.ingestion_logger = lambda: MagicMock()

# grpc
grpc_mod = types.ModuleType("grpc_tools")
grpc_protoc = types.ModuleType("grpc_tools.protoc")
grpc_protoc.main = MagicMock(return_value=0)
grpc_mod.protoc = grpc_protoc

# register ALL modules
sys.modules.update({
    "metadata": types.ModuleType("metadata"),
    "metadata.generated": types.ModuleType("metadata.generated"),
    "metadata.generated.schema": types.ModuleType("metadata.generated.schema"),
    "metadata.generated.schema.entity": types.ModuleType("metadata.generated.schema.entity"),
    "metadata.generated.schema.entity.data": types.ModuleType("metadata.generated.schema.entity.data"),
    "metadata.generated.schema.entity.data.table": table_mod,
    "metadata.generated.schema.type": types.ModuleType("metadata.generated.schema.type"),
    "metadata.generated.schema.type.schema": schema_mod,
    "metadata.utils": types.ModuleType("metadata.utils"),
    "metadata.utils.helpers": helpers_mod,
    "metadata.utils.logger": logger_mod,
    "grpc_tools": grpc_mod,
    "grpc_tools.protoc": grpc_protoc,
})

# ---- IMPORT AFTER STUBS ----
from protobuf_parser import (
    ProtobufParser,
    ProtobufParserConfig,
    _resolve_message_class,
    ProtobufDataTypes,
)

# Now safe to import



# ---------------------------------------------------------------------------
# Helpers: build fake pb2 modules for testing _resolve_message_class
# ---------------------------------------------------------------------------

def _make_pb2_module(message_names: list, module_name: str = "fake_pb2"):
    """
    Build a minimal fake _pb2 module that mimics what grpc/protoc generates.

    Each name in message_names becomes:
      - A real subclass of google.protobuf.message.Message attached to the module
      - An entry in module.DESCRIPTOR.message_types_by_name
    """
    from google.protobuf.message import Message

    mod = types.ModuleType(module_name)

    # Build real Message subclasses so isinstance checks pass
    classes = {}
    for name in message_names:
        cls = type(name, (Message,), {"DESCRIPTOR": MagicMock(name=name, fields=[])})
        classes[name] = cls
        setattr(mod, name, cls)

    # Build a fake DESCRIPTOR that mirrors message_types_by_name
    fake_descriptor = MagicMock()
    fake_descriptor.message_types_by_name = {
        name: MagicMock(name=name) for name in message_names
    }
    mod.DESCRIPTOR = fake_descriptor

    return mod, classes


# ===========================================================================
# 1.  _resolve_message_class — the core fix for #15274
# ===========================================================================

class TestResolveMessageClass:
    """Tests for the _resolve_message_class helper (the actual bug fix)."""

    # --- Strategy 1: PascalCase match (legacy / backward compat) -----------

    def test_legacy_match_when_message_name_equals_topic_camel(self):
        """
        GIVEN topic 'address_book' and a message called 'AddressBook'
        WHEN _resolve_message_class is called
        THEN it resolves via Strategy 1 (PascalCase match) and returns an instance
        """
        mod, classes = _make_pb2_module(["AddressBook"])
        result = _resolve_message_class(mod, "address_book")

        assert result is not None
        assert isinstance(result, classes["AddressBook"])

    def test_legacy_match_single_word_topic(self):
        """
        GIVEN topic 'loans' and a message called 'Loans'
        WHEN _resolve_message_class is called
        THEN Strategy 1 resolves it correctly
        """
        mod, classes = _make_pb2_module(["Loans"])
        result = _resolve_message_class(mod, "loans")

        assert result is not None
        assert isinstance(result, classes["Loans"])

    # --- Strategy 2: DESCRIPTOR fallback (the actual bug fix) --------------

    def test_descriptor_fallback_when_message_name_differs_from_topic(self):
        """
        THE CORE BUG (#15274):
        GIVEN topic 'loans' but message named 'MyLoanRecord' (not 'Loans')
        WHEN _resolve_message_class is called
        THEN Strategy 1 fails, Strategy 2 uses DESCRIPTOR and still resolves correctly
        """
        mod, classes = _make_pb2_module(["MyLoanRecord"])
        result = _resolve_message_class(mod, "loans")

        assert result is not None, (
            "Should resolve via DESCRIPTOR even when message name != topic name. "
            "This was the bug in issue #15274."
        )
        assert isinstance(result, classes["MyLoanRecord"])

    def test_descriptor_fallback_hyphenated_topic_name(self):
        """
        GIVEN topic 'my-loan-record' (hyphenated) and message 'SomethingElse'
        WHEN _resolve_message_class is called
        THEN DESCRIPTOR fallback resolves it
        """
        mod, classes = _make_pb2_module(["SomethingElse"])
        result = _resolve_message_class(mod, "my-loan-record")

        assert result is not None
        assert isinstance(result, classes["SomethingElse"])

    def test_descriptor_fallback_picks_first_message_when_multiple_exist(self):
        """
        GIVEN a schema with multiple top-level messages ['Alpha', 'Beta', 'Gamma']
        and topic name that matches none of them
        WHEN _resolve_message_class is called
        THEN it picks the first declared message ('Alpha')
        """
        mod, classes = _make_pb2_module(["Alpha", "Beta", "Gamma"])
        result = _resolve_message_class(mod, "totally_different_topic")

        assert result is not None
        assert isinstance(result, classes["Alpha"])

    # --- Failure paths -------------------------------------------------------

    def test_returns_none_when_module_has_no_descriptor(self):
        """
        GIVEN a pb2 module with no DESCRIPTOR attribute and no matching class
        WHEN _resolve_message_class is called
        THEN it returns None gracefully (no exception)
        """
        mod = types.ModuleType("broken_pb2")
        # No DESCRIPTOR, no matching class
        result = _resolve_message_class(mod, "loans")
        assert result is None

    def test_returns_none_when_descriptor_has_no_messages(self):
        """
        GIVEN a pb2 module whose DESCRIPTOR.message_types_by_name is empty
        WHEN _resolve_message_class is called
        THEN it returns None gracefully
        """
        mod = types.ModuleType("empty_pb2")
        fake_descriptor = MagicMock()
        fake_descriptor.message_types_by_name = {}
        mod.DESCRIPTOR = fake_descriptor

        result = _resolve_message_class(mod, "loans")
        assert result is None

    def test_returns_none_when_descriptor_lists_name_not_in_module(self):
        """
        GIVEN DESCRIPTOR.message_types_by_name lists 'Ghost' but module has no attribute 'Ghost'
        WHEN _resolve_message_class is called
        THEN it returns None gracefully (does not raise AttributeError)
        """
        mod = types.ModuleType("ghost_pb2")
        fake_descriptor = MagicMock()
        fake_descriptor.message_types_by_name = {"Ghost": MagicMock()}
        mod.DESCRIPTOR = fake_descriptor
        # Note: we do NOT set mod.Ghost — simulates a corrupt/partial module

        result = _resolve_message_class(mod, "loans")
        assert result is None

    def test_non_message_attribute_not_mistakenly_returned(self):
        """
        GIVEN a module where snake_to_camel('loans') == 'Loans' exists but is NOT
        a Message subclass (e.g. it's a plain int)
        WHEN _resolve_message_class is called
        THEN Strategy 1 is skipped and Strategy 2 is tried
        """
        from google.protobuf.message import Message

        mod = types.ModuleType("mixed_pb2")
        mod.Loans = 42  # Not a Message subclass — should be ignored

        # Set up DESCRIPTOR with the real message
        real_cls = type("MyLoanRecord", (Message,), {"DESCRIPTOR": MagicMock(fields=[])})
        mod.MyLoanRecord = real_cls

        fake_descriptor = MagicMock()
        fake_descriptor.message_types_by_name = {"MyLoanRecord": MagicMock()}
        mod.DESCRIPTOR = fake_descriptor

        result = _resolve_message_class(mod, "loans")
        assert result is not None
        assert isinstance(result, real_cls)


# ===========================================================================
# 2.  ProtobufDataTypes enum
# ===========================================================================

class TestProtobufDataTypes:
    """Tests for the ProtobufDataTypes enum and its multi-value members."""

    def test_canonical_values_resolve(self):
        assert ProtobufDataTypes(0) == ProtobufDataTypes.UNKNOWN
        assert ProtobufDataTypes(1) == ProtobufDataTypes.DOUBLE
        assert ProtobufDataTypes(2) == ProtobufDataTypes.FLOAT
        assert ProtobufDataTypes(8) == ProtobufDataTypes.BOOLEAN
        assert ProtobufDataTypes(9) == ProtobufDataTypes.STRING
        assert ProtobufDataTypes(11) == ProtobufDataTypes.RECORD
        assert ProtobufDataTypes(12) == ProtobufDataTypes.BYTES
        assert ProtobufDataTypes(14) == ProtobufDataTypes.ENUM

    def test_int_aliases_all_resolve_to_INT(self):
        """Values 3, 4, 5, 13, 17, 18 should all map to INT."""
        for val in [3, 4, 5, 13, 17, 18]:
            assert ProtobufDataTypes(val) == ProtobufDataTypes.INT, (
                f"Expected INT for value {val}"
            )

    def test_fixed_aliases_all_resolve_to_FIXED(self):
        """Values 6, 7, 15, 16 should all map to FIXED."""
        for val in [6, 7, 15, 16]:
            assert ProtobufDataTypes(val) == ProtobufDataTypes.FIXED, (
                f"Expected FIXED for value {val}"
            )

    def test_invalid_value_raises(self):
        with pytest.raises(ValueError):
            ProtobufDataTypes(999)

    def test_repr_contains_name(self):
        repr_str = repr(ProtobufDataTypes.STRING)
        assert "STRING" in repr_str


# ===========================================================================
# 3.  ProtobufParser._get_field_type()
# ===========================================================================

class TestGetFieldType:
    """Tests for the _get_field_type method."""

    def setup_method(self):
        config = ProtobufParserConfig(
            schema_name="test_schema",
            schema_text="syntax = 'proto3';",
        )
        self.parser = ProtobufParser(config)
        self.FieldModel = schema_mod.FieldModel
        self.Column = table_mod.Column

    def test_returns_unknown_for_type_above_18(self):
        result = self.parser._get_field_type(19)
        assert result == "UNKNOWN"

    def test_returns_unknown_for_type_zero(self):
        result = self.parser._get_field_type(0)
        assert result == "UNKNOWN"

    def test_returns_double_for_type_1(self):
        result = self.parser._get_field_type(1)
        assert result == "DOUBLE"

    def test_returns_string_for_type_9(self):
        result = self.parser._get_field_type(9)
        assert result == "STRING"

    def test_returns_int_for_all_int_aliases(self):
        for val in [3, 4, 5, 13, 17, 18]:
            result = self.parser._get_field_type(val)
            assert result == "INT", f"Expected INT for type {val}, got {result}"

    def test_fixed_returns_INT_when_cls_is_Column(self):
        """
        When cls=Column, FIXED types should be returned as INT
        (different behaviour from FieldModel).
        """
        # type 6 maps to FIXED
        result = self.parser._get_field_type(6, cls=self.Column)
        assert result == "INT"

    def test_fixed_returns_FIXED_when_cls_is_FieldModel(self):
        result = self.parser._get_field_type(6, cls=self.FieldModel)
        assert result == "FIXED"


# ===========================================================================
# 4.  ProtobufParser.get_protobuf_fields()
# ===========================================================================

class TestGetProtobufFields:
    """Tests for the recursive field extraction logic."""

    def setup_method(self):
        config = ProtobufParserConfig(
            schema_name="loans",
            schema_text="syntax = 'proto3';",
        )
        self.parser = ProtobufParser(config)

    def _make_scalar_field(self, name: str, type_: int):
        """Helper: build a mock Protobuf scalar field descriptor."""
        field = MagicMock()
        field.name = name
        field.type = type_
        field.message_type = None
        return field

    def _make_record_field(self, name: str, sub_fields: list):
        """Helper: build a mock Protobuf RECORD (nested message) field descriptor."""
        field = MagicMock()
        field.name = name
        field.type = 11  # RECORD
        field.message_type = MagicMock()
        field.message_type.fields = sub_fields
        return field

    def test_empty_fields_returns_empty_list(self):
        result = self.parser.get_protobuf_fields([])
        assert result == []

    def test_single_scalar_field(self):
        """A single int32 field should produce one FieldModel with no children."""
        FieldModel = schema_mod.FieldModel

        amount_field = self._make_scalar_field("amount", 3)  # 3 = INT
        result = self.parser.get_protobuf_fields([amount_field])

        assert len(result) == 1
        FieldModel.assert_called_with(name="amount", dataType="INT", children=None)

    def test_multiple_scalar_fields(self):
        """Multiple fields produce multiple FieldModels in order."""
        FieldModel = schema_mod.FieldModel
        FieldModel.reset_mock()

        fields = [
            self._make_scalar_field("amount", 3),    # INT
            self._make_scalar_field("rate", 1),      # DOUBLE
            self._make_scalar_field("label", 9),     # STRING
        ]
        result = self.parser.get_protobuf_fields(fields)
        assert len(result) == 3

    def test_nested_record_field_recurses(self):
        """A RECORD field (type=11) should recurse into its sub-fields."""
        FieldModel = schema_mod.FieldModel
        FieldModel.reset_mock()

        child_field = self._make_scalar_field("zip_code", 9)  # STRING
        address_field = self._make_record_field("address", [child_field])

        self.parser.get_protobuf_fields([address_field])

        # Should have been called for both the parent and the child
        calls = FieldModel.call_args_list
        names_called = [c.kwargs.get("name") or c.args[0] for c in calls]
        assert "address" in str(calls)
        assert "zip_code" in str(calls)

    def test_bad_field_is_skipped_not_raised(self):
        """
        If one field is malformed, the parser should skip it gracefully
        and continue processing the remaining fields.
        """
        FieldModel = schema_mod.FieldModel
        FieldModel.reset_mock()

        bad_field = MagicMock()
        bad_field.name = "broken"
        bad_field.type = MagicMock(side_effect=Exception("boom"))

        good_field = self._make_scalar_field("amount", 3)

        # Should not raise; bad field is skipped, good field is processed
        result = self.parser.get_protobuf_fields([bad_field, good_field])
        # good_field still produced a result
        assert len(result) >= 1


# ===========================================================================
# 5.  ProtobufParser.create_proto_files()
# ===========================================================================

class TestCreateProtoFiles:
    """Tests for the directory/file creation step."""

    def setup_method(self):
        config = ProtobufParserConfig(
            schema_name="loans",
            schema_text="syntax = 'proto3'; message MyLoanRecord {}",
            base_file_path="/tmp/test_protobuf",
        )
        self.parser = ProtobufParser(config)

    @patch("protobuf_parser.Path")
    @patch("builtins.open", new_callable=mock_open)
    def test_creates_directories_and_proto_file(self, mock_file, MockPath):
        """Should create both directory paths and write schema_text to .proto file."""
        mock_path_instance = MagicMock()
        MockPath.return_value = mock_path_instance

        result = self.parser.create_proto_files()

        # Both directories must be created
        assert mock_path_instance.mkdir.call_count >= 2

        # The .proto file must be written with the schema text
        mock_file.assert_called_once()
        handle = mock_file()
        handle.write.assert_called_once_with(
            "syntax = 'proto3'; message MyLoanRecord {}"
        )

        # Must return a tuple (proto_path, file_path)
        assert result is not None
        proto_path, file_path = result
        assert "loans.proto" in file_path

    @patch("protobuf_parser.Path")
    def test_returns_none_on_exception(self, MockPath):
        """If directory creation raises, should return None without crashing."""
        MockPath.return_value.mkdir.side_effect = PermissionError("no access")

        result = self.parser.create_proto_files()
        assert result is None


# ===========================================================================
# 6.  ProtobufParser.get_protobuf_python_object()
# ===========================================================================

class TestGetProtobufPythonObject:
    """
    Tests for the compile-and-import step.
    The real compilation is mocked — we only test the logic around it.
    """

    def setup_method(self):
        config = ProtobufParserConfig(
            schema_name="loans",
            schema_text="syntax = 'proto3';",
            base_file_path="/tmp/test_protobuf",
        )
        self.parser = ProtobufParser(config)

    @patch("protobuf_parser._resolve_message_class")
    @patch("protobuf_parser.importlib.import_module")
    @patch("protobuf_parser.glob.glob")
    @patch("grpc_tools.protoc.main")
    @patch("protobuf_parser.grpc_tools.protoc.main")
    @patch("protobuf_parser.sys.path")
    def test_calls_resolve_message_class(
        self,
        mock_sys_path,
        mock_protoc,
        _mock_protoc_alias,
        mock_glob,
        mock_import,
        mock_resolve,
    ):
        """
        _resolve_message_class should be called with the imported module
        and the schema_name — verifying the fix is wired in.
        """
        mock_protoc.return_value = 0
        mock_glob.return_value = ["/tmp/test_protobuf/generated/loans_pb2.py"]
        fake_module = MagicMock()
        mock_import.return_value = fake_module
        fake_instance = MagicMock()
        mock_resolve.return_value = fake_instance

        result = self.parser.get_protobuf_python_object(
            proto_path="generated=/tmp/test_protobuf/interfaces",
            file_path="/tmp/test_protobuf/interfaces/loans.proto",
        )

        mock_resolve.assert_called_once_with(fake_module, "loans")
        assert result is fake_instance

    @patch("protobuf_parser.grpc_tools.protoc.main", side_effect=Exception("protoc failed"))
    def test_returns_none_on_compile_error(self, mock_protoc):
        """If protoc fails, should return None without raising."""
        result = self.parser.get_protobuf_python_object(
            proto_path="generated=/tmp/x/interfaces",
            file_path="/tmp/x/interfaces/loans.proto",
        )
        assert result is None


# ===========================================================================
# 7.  ProtobufParser.parse_protobuf_schema()
# ===========================================================================

class TestParseProtobufSchema:
    """Integration-style tests for the top-level parse method."""

    def setup_method(self):
        config = ProtobufParserConfig(
            schema_name="loans",
            schema_text="syntax = 'proto3'; message MyLoanRecord { int32 amount = 1; }",
            base_file_path="/tmp/test_protobuf",
        )
        self.parser = ProtobufParser(config)

    @patch("protobuf_parser.shutil.rmtree")
    @patch("protobuf_parser.Path")
    def test_returns_field_models_on_success(self, MockPath, mock_rmtree):
        """
        GIVEN a valid instance returned by get_protobuf_python_object
        WHEN parse_protobuf_schema is called
        THEN it should return a list with one top-level FieldModel
        """
        MockPath.return_value.exists.return_value = True

        fake_field = MagicMock()
        fake_field.name = "amount"
        fake_field.type = 3  # INT
        fake_field.message_type = None

        fake_descriptor = MagicMock()
        fake_descriptor.name = "MyLoanRecord"
        fake_descriptor.fields = [fake_field]

        fake_instance = MagicMock()
        fake_instance.DESCRIPTOR = fake_descriptor

        with patch.object(self.parser, "create_proto_files", return_value=("pp", "fp")):
            with patch.object(self.parser, "get_protobuf_python_object", return_value=fake_instance):
                result = self.parser.parse_protobuf_schema()

        assert result is not None
        assert len(result) == 1

        # Cleanup must always be called
        mock_rmtree.assert_called_once()

    @patch("protobuf_parser.shutil.rmtree")
    @patch("protobuf_parser.Path")
    def test_returns_none_when_instance_is_none(self, MockPath, mock_rmtree):
        """
        GIVEN get_protobuf_python_object returns None (e.g. message name mismatch
        was NOT fixed — this is the pre-fix regression scenario)
        WHEN parse_protobuf_schema is called
        THEN it should return None without crashing
        """
        MockPath.return_value.exists.return_value = False

        with patch.object(self.parser, "create_proto_files", return_value=("pp", "fp")):
            with patch.object(self.parser, "get_protobuf_python_object", return_value=None):
                result = self.parser.parse_protobuf_schema()

        assert result is None

    @patch("protobuf_parser.Path")
    def test_returns_none_when_create_proto_files_fails(self, MockPath):
        """If create_proto_files returns None, parse should return None gracefully."""
        with patch.object(self.parser, "create_proto_files", return_value=None):
            result = self.parser.parse_protobuf_schema()

        assert result is None

    @patch("protobuf_parser.shutil.rmtree")
    @patch("protobuf_parser.Path")
    def test_cleanup_runs_even_after_success(self, MockPath, mock_rmtree):
        """The tmp directory should always be cleaned up after parsing."""
        MockPath.return_value.exists.return_value = True

        fake_instance = MagicMock()
        fake_instance.DESCRIPTOR.name = "MyLoanRecord"
        fake_instance.DESCRIPTOR.fields = []

        with patch.object(self.parser, "create_proto_files", return_value=("pp", "fp")):
            with patch.object(self.parser, "get_protobuf_python_object", return_value=fake_instance):
                self.parser.parse_protobuf_schema()

        mock_rmtree.assert_called_once()


# ===========================================================================
# 8.  Regression tests — exact scenarios from issue #15274
# ===========================================================================

class TestIssue15274Regression:
    """
    Regression suite that directly maps to the bug report scenarios.
    These test names match the exact conditions described in the issue.
    """

    def test_topic_loans_message_MyLoanRecord(self):
        """
        Issue #15274 exact scenario:
        Topic = 'loans', Message = 'MyLoanRecord'
        Old code: getattr(pb2, 'Loans') → AttributeError → None → crash
        New code: DESCRIPTOR fallback → resolves 'MyLoanRecord' → success
        """
        mod, classes = _make_pb2_module(["MyLoanRecord"])
        result = _resolve_message_class(mod, "loans")

        assert result is not None, (
            "Regression: topic 'loans' with message 'MyLoanRecord' must resolve. "
            "This was broken in issue #15274."
        )
        assert isinstance(result, classes["MyLoanRecord"])

    def test_topic_address_book_message_AddressBook_still_works(self):
        """
        Backward compat: the original working case must still work.
        Topic = 'address_book', Message = 'AddressBook' (names match)
        """
        mod, classes = _make_pb2_module(["AddressBook"])
        result = _resolve_message_class(mod, "address_book")

        assert result is not None, "Backward compat regression: address_book/AddressBook broke."
        assert isinstance(result, classes["AddressBook"])

    def test_warning_was_NoneType_no_longer_raised(self):
        """
        Before the fix, the code raised:
            'NoneType' object has no attribute 'DESCRIPTOR'
        After the fix, _resolve_message_class returns a real instance,
        so DESCRIPTOR access never hits None.
        """
        mod, classes = _make_pb2_module(["MyLoanRecord"])
        instance = _resolve_message_class(mod, "loans")

        # This line would crash before the fix
        try:
            _ = instance.DESCRIPTOR
        except AttributeError as exc:
            pytest.fail(
                f"Regression: accessing .DESCRIPTOR on resolved instance raised: {exc}"
            )