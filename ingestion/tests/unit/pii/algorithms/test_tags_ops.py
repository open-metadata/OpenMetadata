from metadata.pii.algorithms.tags import PIITag
from metadata.pii.algorithms.tags_ops import categorize_pii_tag


def test_each_pii_tag_is_mapped_to_a_pii_tag_category():
    """
    Test that each PII tag is mapped to a PII tag category.
    """
    for tag in PIITag:
        try:
            _ = categorize_pii_tag(tag)
        except ValueError:
            raise AssertionError(f"PII tag {tag} is not mapped to a category.")


def test_get_general_tag_fqn():
    """
    Test that the general tag FQN is built correctly.
    """
    from metadata.pii.algorithms.tags import PIICategoryTag
    from metadata.pii.algorithms.tags_ops import get_general_tag_fqn

    assert get_general_tag_fqn(PIICategoryTag.PERSON) == "General.Person"
    assert get_general_tag_fqn(PIICategoryTag.CREDIT_CARD) == "General.CreditCardNumber"
    assert get_general_tag_fqn(PIICategoryTag.BANK_NUMBER) == "General.BankNumber"
