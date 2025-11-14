from presidio_analyzer import Pattern

credit_cards = [
    Pattern("Credit Card Number", pattern, 0.7)
    for pattern in (
        # Visa: 13 or 16 digits, starts with 4
        r"^4\d{12}(?:\d{3})?$",
        # Mastercard: 16 digits
        # Includes both old range (51-55) and new range (2221-2720)
        r"^(?:5[1-5]\d{2}|2(?:22[1-9]|2[3-9]\d|[3-6]\d{2}|7[01]\d|720))\d{12}$",
        # American Express: 15 digits, starts with 34 or 37
        r"^3[47]\d{13}$",
        # Diners Club: 14 digits, starts with 300-305, 36, or 38
        r"^3(?:0[0-5]|[68]\d)\d{11}$",
        # Discover: 16 digits
        # Starts with 6011, 622126-622925, 644-649, or 65
        r"^(?:6011|65\d{2}|64[4-9]\d|622(?:1(?:2[6-9]|[3-9]\d)|[2-8]\d{2}|9(?:[01]\d|2[0-5])))\d{12}$",
        # JCB: 16 digits, starts with 3528-3589
        r"^35(?:2[89]|[3-8]\d)\d{12}$",
        # Maestro: 12-19 digits
        # Starts with 5018, 5020, 5038, 5893, 6304, 6759, 6761-6763
        r"^(?:50(?:18|20|38)|5893|6(?:304|759|76[1-3]))\d{8,15}$",
        # UnionPay: 16-19 digits, starts with 62
        r"^62\d{14,17}$",
    )
]

us_driving_license = [
    Pattern("US Driving License", pattern, 0.3)
    for pattern in (
        r"\d{7}",
        r"[a-zA-Z]\d{8}",
        r"\d{9}",
        r"9\d{8}",
        r"[a-zA-Z]\d{7}",
        r"\d{2}-\d{3}-\d{4}",
        r"[a-zA-Z] \d{3} \d{3} \d{3} \d{3}",
        r"[a-zA-Z]\d{12}",
        r"[a-zA-Z]\d{3}-\d{3}-\d{2}-\d{3}-\d",
        r"[a-zA-Z]-\d{3}-\d{3}-\d{3}-\d{3}",
        r"[a-zA-Z]\s\d{3}\s\d{3}\s\d{3}\s\d{3}",
        r"[a-zA-Z]\d{12}",
        r"[a-zA-Z]{2}\d{6}[a-zA-Z]",
        r"[a-zA-Z]\d{3}-\d{4}-\d{4}",
        r"[a-zA-Z]\d{11}",
        r"\d{4}-\d{2}-\d{4}",
        r"\d{3}[a-zA-Z]{2}\d{4}",
        r"[a-zA-Z]\d{2}-\d{2}-\d{4}",
        r"[a-zA-Z]\d{2}-\d{3}-\d{3}",
        r"[a-zA-Z]\d{9}",
        r"\d{3}-\d{2}-\d{4}",
        r"[a-zA-Z]\d{9}",
        r"(([0][1-9]|[1][0-2])\d{3}([1-9][0-9]{3})41([0][1-9]|[1][0-9]|[3][0-1]))\d{10}",
        r"([0][1-9]|[1][0-2])[a-zA-Z]{3}\d{2}(0[1-9]|[1-2][0-9]|3[0-1])\d",
        r"[a-zA-Z]\d{4}-\d{5}-\d{5}",
        r"[a-zA-Z]\d{14}",
        r"\d{3} \d{3} \d{3}",
        r"\d{12}",
        r"[a-zA-Z]{3}-\d{2}-\d{4}",
        r"[a-zA-Z]{1}[0-9]{4,8}",
        r"[a-zA-Z]{2}[0-9]{3,7}",
        r"\d{2}\s\d{3}\s\d{3}",
        r"[1-9]{2}\d{5}",
        r"\d{8}",
        r"\d{7,9}",
        r"\d{7}[a-zA-Z]",
        r"[a-zA-Z]\d{8}",
        r"[a-zA-Z*]{1,6}[a-zA-Z]{2}\d[a-zA-Z0-9]{4,6}",
        r"[a-zA-Z]\d{6}",
        r"[a-zA-Z]\d{3}-\d{4}-\d{4}-\d{2}",
        r"\d{6}-\d{3}",
        r"\d{2}[a-zA-Z]{3}\d{5}",
        r"\d{13}",
    )
]

au_tfn_number = [
    Pattern(
        "TFN (High)",
        r"\bTFN:\s?\d{3}\s\d{3}\s\d{3}\b",
        0.7,
    ),
    Pattern(
        "TFN (High)",
        r"\bTFN:\s?\d{3}-\d{3}-\d{3}\b",
        0.7,
    ),
    Pattern(
        "TFN (High)",
        r"\bTFN:\s?\d{9}\b",
        0.7,
    ),
    Pattern(
        "TFN (Medium)",
        r"\b\d{3}\s\d{3}\s\d{3}\b",
        0.1,
    ),
    Pattern(
        "TFN (Medium)",
        r"\b\d{3}-\d{3}-\d{3}\b",
        0.1,
    ),
    Pattern(
        "TFN (Low)",
        r"\b\d{9}\b",
        0.01,
    ),
]
