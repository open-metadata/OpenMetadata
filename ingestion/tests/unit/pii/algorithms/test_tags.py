import json

from metadata.pii.algorithms.tags import PIICategoryTag
from tests import REPO_ROOT_DIR


def test_pii_categories_agree_with_openmetadata_ner_entities() -> None:
    """
    Test that the PII categories agree with the OpenMetadata service
    """
    path = (
        REPO_ROOT_DIR
        / "openmetadata-service/src/main/resources/json/data/tags/NEREntityGeneralTags.json"
    )
    with open(path, "r") as file:
        data = json.load(file)
        tag_labels = {create_tag["name"] for create_tag in data["createTags"]}
        pii_category_tag = {pii_cat_tag.value for pii_cat_tag in PIICategoryTag}
        assert (
            pii_category_tag == tag_labels
        ), f"PII Category Tags {pii_category_tag} do not match OpenMetadata NEREntityGeneralTags {tag_labels}"
