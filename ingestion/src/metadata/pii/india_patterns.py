"""
India specific PII patterns for DPDP Act 2023 compliance.
Extends OpenMetadata auto PII tagging with locale aware detection.
"""

import re

# Patterns for column name matching
INDIA_COLUMN_PATTERNS = {
    "aadhaar": re.compile(r".*aadhaar.*|.*aadhar.*|.*uidai.*", re.IGNORECASE),
    "pan": re.compile(
        r".*\bpan_?(card|number|no|num)\b.*|.*permanent_account.*",
        re.IGNORECASE,
    ),
    "upi": re.compile(
        r".*\bupi_?(id|address|vpa)\b.*|.*\bvpa\b.*",
        re.IGNORECASE,
    ),
}

# Verhoeff algorithm for Aadhaar validation
_VERHOEFF_D = [
 [0,1,2,3,4,5,6,7,8,9],
 [1,2,3,4,0,6,7,8,9,5],
 [2,3,4,0,1,7,8,9,5,6],
 [3,4,0,1,2,8,9,5,6,7],
 [4,0,1,2,3,9,5,6,7,8],
 [5,9,8,7,6,0,4,3,2,1],
 [6,5,9,8,7,1,0,4,3,2],
 [7,6,5,9,8,2,1,0,4,3],
 [8,7,6,5,9,3,2,1,0,4],
 [9,8,7,6,5,4,3,2,1,0]
]

_VERHOEFF_P = [
 [0,1,2,3,4,5,6,7,8,9],
 [1,5,7,6,2,8,3,0,9,4],
 [5,8,0,3,7,9,6,1,4,2],
 [8,9,1,6,0,4,3,5,2,7],
 [9,4,5,3,1,2,6,8,7,0],
 [4,2,8,6,5,7,3,9,0,1],
 [2,7,9,3,8,0,6,4,1,5],
 [7,0,4,6,9,1,3,2,5,8]
]

def validate_aadhaar(number: str) -> bool:
    """
    Validate Aadhaar number using Verhoeff checksum.
    Returns True only if 12 digits pass the algorithm.
    This prevents tagging random 12-digit order IDs as Aadhaar.
    """
    if not number or len(number)!= 12 or not number.isdigit():
        return False

    # UIDAI rule: Aadhaar cannot start with 0 or 1
    if number[0] in ('0', '1'):
        return False

    c = 0
    for i, digit in enumerate(reversed(number)):
        c = _VERHOEFF_D[c][_VERHOEFF_P[i % 8][int(digit)]]
    return c == 0

def validate_pan(number: str) -> bool:
    """
    Validate PAN format: 5 uppercase letters, 4 digits, 1 uppercase letter.
    4th character must be one of: A,B,C,F,G,H,J,L,P,T
    """
    if not number:
        return False
    if not re.match(r'^[A-Z]{5}[0-9]{4}[A-Z]$', number):
        return False

    # Check 4th character (index 3) is valid holder type
    valid_types = {'A', 'B', 'C', 'F', 'G', 'H', 'J', 'L', 'P', 'T'}
    return number[3] in valid_types

def is_india_pii_column(column_name: str) -> str | None:
    """
    Check if column name matches India PII patterns.
    Returns the PII type or None.
    """
    name_lower = column_name.lower()

    if INDIA_COLUMN_PATTERNS["aadhaar"].match(name_lower):
        return "Aadhaar"
    if INDIA_COLUMN_PATTERNS["pan"].match(name_lower):
        return "PAN"
    if INDIA_COLUMN_PATTERNS["upi"].match(name_lower):
        return "UPI"

    return None
