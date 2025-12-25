import pytest

from metadata.utils.credentials import normalize_pem_string


def test_normalizes_escaped_newlines_for_pem():
    """It should replace literal '\\n' with actual newlines for PEM-like strings."""
    pem = "-----BEGIN PRIVATE KEY-----\\nABCDEF\\n-----END PRIVATE KEY-----"
    result = normalize_pem_string(pem)
    # Should contain actual newlines, not literal \n
    assert "\n" in result
    assert "\\n" not in result
    # Should start/end correctly
    assert result.startswith("-----BEGIN PRIVATE KEY-----")
    assert result.endswith("-----END PRIVATE KEY-----")


def test_does_not_change_already_correct_pem():
    """It should leave PEMs with real newlines unchanged."""
    pem = "-----BEGIN PRIVATE KEY-----\nABCDEF\n-----END PRIVATE KEY-----"
    result = normalize_pem_string(pem)
    assert result == pem


def test_ignores_non_pem_strings():
    """It should not touch non-PEM strings, even if they contain '\\n'."""
    s = "password\\nwith\\nnewlines"
    result = normalize_pem_string(s)
    assert result == s  # unchanged


def test_handles_other_pem_types():
    """It should detect and normalize other PEM headers like certificates."""
    cert = "-----BEGIN CERTIFICATE-----\\nXYZ\\n-----END CERTIFICATE-----"
    result = normalize_pem_string(cert)
    assert "\n" in result and "\\n" not in result


def test_mixed_case_is_left_unchanged():
    """If both literal and real newlines exist, don't double-convert."""
    mixed = "-----BEGIN PRIVATE KEY-----\\nABC\nDEF\\n-----END PRIVATE KEY-----"
    result = normalize_pem_string(mixed)
    # It should be left unchanged, since it has both kinds of newlines
    assert result == mixed


@pytest.mark.parametrize("invalid", [None, 123, b"not a string"])
def test_non_string_inputs_return_untouched(invalid):
    """Non-string inputs should be returned as-is (no crash)."""
    assert normalize_pem_string(invalid) == invalid
