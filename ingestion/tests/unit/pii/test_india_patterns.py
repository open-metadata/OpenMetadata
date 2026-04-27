import pytest
from metadata.pii.india_patterns import (
    validate_aadhaar,
    validate_pan,
    is_india_pii_column,
)

def test_aadhaar_validation():
    # Valid test Aadhaar (passes Verhoeff)
    assert validate_aadhaar("999999990019") is True
    # Invalid - fails checksum
    assert validate_aadhaar("123456789012") is False
    # Invalid - wrong length
    assert validate_aadhaar("12345") is False
    # Invalid - not digits
    assert validate_aadhaar("abcdefghijkl") is False

def test_pan_validation():
    assert validate_pan("ABCDE1234F") is True
    assert validate_pan("abcdE1234f") is False # must be uppercase
    assert validate_pan("ABCD1234F") is False # too short
    assert validate_pan("ABCDE12345") is False # wrong format

def test_column_name_matching():
    assert is_india_pii_column("aadhaar_number") == "Aadhaar"
    assert is_india_pii_column("customer_pan") == "PAN"
    assert is_india_pii_column("upi_id") == "UPI"
    assert is_india_pii_column("order_id") is None
