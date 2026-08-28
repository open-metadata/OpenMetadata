from metadata.utils.logger import redacted_config, sanitize_url_credentials


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


def test_sanitize_url_credentials():
    assert (
        sanitize_url_credentials("https://my_secret_pat@dev.azure.com/org/repo")
        == "https://****@dev.azure.com/org/repo"
    )
    assert (
        sanitize_url_credentials("https://x-oauth-basic:token123@github.com/owner/repo.git")
        == "https://****@github.com/owner/repo.git"
    )
    assert (
        sanitize_url_credentials("https://x-token-auth:secret@gitlab.com/owner/repo.git")
        == "https://****@gitlab.com/owner/repo.git"
    )
    assert sanitize_url_credentials("no url here") == "no url here"
