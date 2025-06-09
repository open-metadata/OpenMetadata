import pytest

from metadata.pii.algorithms.tags import PIISensitivityTag, PIITag
from metadata.pii.algorithms.tags_ops import categorize_pii_tag, resolve_sensitivity


def test_each_pii_tag_is_mapped_to_a_pii_tag_category():
    """
    Test that each PII tag is mapped to a PII tag category.
    """
    for tag in PIITag:
        try:
            _ = categorize_pii_tag(tag)
        except ValueError:
            raise AssertionError(f"PII tag {tag} is not mapped to a category.")


@pytest.mark.parametrize(
    "input_tags,expected",
    [
        ([], None),
        ([PIISensitivityTag.NONSENSITIVE], PIISensitivityTag.NONSENSITIVE),
        ([PIISensitivityTag.SENSITIVE], PIISensitivityTag.SENSITIVE),
        (
            [PIISensitivityTag.NONSENSITIVE, PIISensitivityTag.NONSENSITIVE],
            PIISensitivityTag.NONSENSITIVE,
        ),
        (
            [PIISensitivityTag.NONSENSITIVE, PIISensitivityTag.SENSITIVE],
            PIISensitivityTag.SENSITIVE,
        ),
        (
            [PIISensitivityTag.SENSITIVE, PIISensitivityTag.SENSITIVE],
            PIISensitivityTag.SENSITIVE,
        ),
    ],
)
def test_resolve_sensitivity(input_tags, expected):
    assert resolve_sensitivity(input_tags) == expected
