from metadata.generated.schema.type.tagLabel import LabelType, TagSource
from metadata.pii.algorithms.tags import PIICategoryTag, PIISensitivityTag
from metadata.pii.processor import get_tag_label


def test_get_general_tag_label_from_pii_tag_category():
    """
    Test that the general tag FQN from a tag category never fails.
    """
    for tag in PIICategoryTag:
        try:
            tag_label = get_tag_label(tag)
            assert tag_label.tagFQN.root == f"General.{tag.value}"
            assert tag_label.source == TagSource.Classification
            assert tag_label.labelType == LabelType.Generated
        except ValueError:
            raise AssertionError(f"Failed to get general tag FQN for tag {tag}.")


def test_get_general_tag_label_from_pii_sensitivity():
    """
    Test that the general tag FQN from a PII sensitivity never fails.
    """
    for tag in PIISensitivityTag:
        try:
            tag_label = get_tag_label(tag)
            assert tag_label.tagFQN.root == f"PII.{tag.value}"
            assert tag_label.source == TagSource.Classification
            assert tag_label.labelType == LabelType.Generated
        except ValueError:
            raise AssertionError(
                f"Failed to get general tag FQN for sensitivity {tag}."
            )
