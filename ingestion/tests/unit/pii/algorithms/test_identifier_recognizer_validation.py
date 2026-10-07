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
Tests for the corrected validate_result overrides in presidio_utils.py.

Each class exercises the check-digit / date-validation bug that was present in
Presidio's upstream implementation and fixed by our subclass.
"""

import pytest

from metadata.pii.algorithms.presidio_utils import (
    ValidatedAuAcnRecognizer,
    ValidatedFiPersonalIdentityCodeRecognizer,
    ValidatedItFiscalCodeRecognizer,
    ValidatedPlPeselRecognizer,
)


# ---------------------------------------------------------------------------
# PlPeselRecognizer — complement step was missing
# ---------------------------------------------------------------------------


class TestValidatedPlPeselRecognizer:
    """PESEL check digit = (10 - weighted_sum % 10) % 10."""

    def setup_method(self):
        self.rec = ValidatedPlPeselRecognizer()

    @pytest.mark.parametrize(
        "pesel",
        [
            "44051401458",  # classic example; check digit 8
            "90090515836",  # another real-format PESEL
        ],
    )
    def test_valid_pesel_accepted(self, pesel: str):
        assert self.rec.validate_result(pesel) is True

    @pytest.mark.parametrize(
        "pesel",
        [
            "44051401459",  # check digit off by one
            "44051401450",  # check digit = 0 instead of 8
        ],
    )
    def test_invalid_pesel_rejected(self, pesel: str):
        assert self.rec.validate_result(pesel) is False

    def test_pesel_with_check_digit_zero(self):
        # Ensure (10 - 10) % 10 == 0 path is handled (complement of 0 mod 10 = 0)
        # 00000000003 has weighted sum = 0 → check digit = (10-0)%10 = 0 → wait that's 0 not 3
        # Let's compute a PESEL where sum % 10 == 0 → check digit = 0
        # weights: [1,3,7,9,1,3,7,9,1,3], digits[0:10] all zero → sum = 0 → check = 0
        assert self.rec.validate_result("00000000000") is True

    def test_wrong_length_returns_false(self):
        assert self.rec.validate_result("1234567890") is False
        assert self.rec.validate_result("123456789012") is False


# ---------------------------------------------------------------------------
# ItFiscalCodeRecognizer — returned None instead of False on mismatch
# ---------------------------------------------------------------------------


class TestValidatedItFiscalCodeRecognizer:
    """Italian fiscal code: mismatch must return False, not None."""

    def setup_method(self):
        self.rec = ValidatedItFiscalCodeRecognizer()

    def test_valid_fiscal_code_returns_true(self):
        # Publicly known valid Italian fiscal code (fictional person)
        assert self.rec.validate_result("RSSMRA85T10A562S") is True

    def test_invalid_check_char_returns_false_not_none(self):
        # Same code but last character changed — must be False, not None
        result = self.rec.validate_result("RSSMRA85T10A562X")
        assert result is False, f"Expected False, got {result!r}"

    def test_another_invalid_code_returns_false(self):
        result = self.rec.validate_result("RSSMRA85T10A562A")
        assert result is False


# ---------------------------------------------------------------------------
# AuAcnRecognizer — missing % 10 on complement
# ---------------------------------------------------------------------------


class TestValidatedAuAcnRecognizer:
    """ACN check digit = (10 - weighted_sum % 10) % 10."""

    def setup_method(self):
        self.rec = ValidatedAuAcnRecognizer()

    @pytest.mark.parametrize(
        "acn",
        [
            "000250000",   # from the issue; weighted sum % 10 == 0 → check digit 0
            "004085616",   # real ACN format
        ],
    )
    def test_valid_acn_accepted(self, acn: str):
        assert self.rec.validate_result(acn) is True

    def test_invalid_acn_rejected(self):
        # Corrupt last digit of 000250000
        assert self.rec.validate_result("000250001") is False

    def test_acn_with_spaces(self):
        # Spaces stripped before validation
        assert self.rec.validate_result("000 250 000") is True

    def test_wrong_length_returns_false(self):
        assert self.rec.validate_result("00025000") is False


# ---------------------------------------------------------------------------
# FiPersonalIdentityCodeRecognizer — ignored century separator
# ---------------------------------------------------------------------------


class TestValidatedFiPersonalIdentityCodeRecognizer:
    """Finnish HETU: separator char encodes century; date must be valid for that century."""

    def setup_method(self):
        self.rec = ValidatedFiPersonalIdentityCodeRecognizer()

    def test_valid_hetu_1900s(self):
        # 010101-123N: 1 Jan 1901, individual 123, check N
        assert self.rec.validate_result("010101-123N") is True

    def test_valid_hetu_2000s(self):
        # 290200A1239: 29 Feb 2000 (2000 is a leap year), separator A → 2000s
        # check char: number_part = "290200" + "123" = "290200123", 290200123 % 31
        # 290200123 / 31 = 9361294 remainder 9 → check char = '9'
        assert self.rec.validate_result("290200A1239") is True

    def test_invalid_date_1900s_rejected(self):
        # 290200-1239: 29 Feb 1900 — 1900 is NOT a leap year → invalid date
        result = self.rec.validate_result("290200-1239")
        assert result is False, f"Expected False for non-existent date, got {result!r}"

    def test_invalid_check_char_rejected(self):
        # 010101-123X: wrong check character
        assert self.rec.validate_result("010101-123X") is False

    def test_1800s_separator(self):
        # + separator → 1800s
        assert self.rec.validate_result("010101+123N") is True

    def test_unknown_separator_returns_false(self):
        # Z is not a valid HETU separator; check char N is correct for 010101123
        # so the False result unambiguously tests separator rejection.
        assert self.rec.validate_result("010101Z123N") is False

    def test_2023_separator_u_is_1900s(self):
        # U is a 1900s separator per Finland's 2023 reform.
        # 290200U1239: 29 Feb 1900 — 1900 is NOT a leap year → invalid date.
        # (Without the fix U would be treated as 2000 and 29 Feb 2000 would pass.)
        assert self.rec.validate_result("290200U1239") is False

    def test_2023_separator_a_is_2000s(self):
        # A is a 2000s separator per Finland's 2023 reform.
        # 290200A1239: 29 Feb 2000 — 2000 IS a leap year → valid.
        assert self.rec.validate_result("290200A1239") is True

    def test_wrong_length_returns_none(self):
        assert self.rec.validate_result("010101-12") is None
