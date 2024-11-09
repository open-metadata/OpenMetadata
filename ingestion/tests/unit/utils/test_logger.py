from metadata.utils.logger import redacted_config


def test_safe_config_logger():
    example_obj = {
        "serviceConnection": "some_value",
        "securityConfig": "another_value",
        "nested": {
            "serviceConnection": "another_value",
            "list": [
                {"serviceConnection": "value_in_list"},
                {"otherField": "other_value"},
                {"securityConfig": "security_value"},
            ],
        },
    }

    result = redacted_config(example_obj)
    expected = {
        "serviceConnection": "REDACTED",
        "securityConfig": "REDACTED",
        "nested": {
            "serviceConnection": "REDACTED",
            "list": [
                {"serviceConnection": "REDACTED"},
                {"otherField": "other_value"},
                {"securityConfig": "REDACTED"},
            ],
        },
    }
    assert result == expected
