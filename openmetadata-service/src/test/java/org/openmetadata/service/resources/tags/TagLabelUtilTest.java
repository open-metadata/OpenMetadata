package org.openmetadata.service.resources.tags;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Date;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.jdbi3.CollectionDAO;

class TagLabelUtilTest {

  @Test
  void mergeTagsWithIncomingPrecedence_removesAutomatedTagsAbsentFromIncoming() {
    TagLabel automated1 =
        new TagLabel()
            .withTagFQN("Tier.Tier1")
            .withLabelType(TagLabel.LabelType.AUTOMATED)
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withState(TagLabel.State.CONFIRMED);
    TagLabel automated2 =
        new TagLabel()
            .withTagFQN("Tier.Tier2")
            .withLabelType(TagLabel.LabelType.AUTOMATED)
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withState(TagLabel.State.CONFIRMED);
    TagLabel manual =
        new TagLabel()
            .withTagFQN("PII.Sensitive")
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withState(TagLabel.State.CONFIRMED);

    List<TagLabel> existing = List.of(automated1, automated2, manual);
    List<TagLabel> incoming = List.of(automated1);

    List<TagLabel> result =
        TagLabelUtil.mergeTagsWithIncomingPrecedence(existing, incoming);

    List<String> resultFqns = result.stream().map(TagLabel::getTagFQN).toList();
    assertTrue(resultFqns.contains("Tier.Tier1"), "Automated tag still in incoming must be kept");
    assertFalse(
        resultFqns.contains("Tier.Tier2"),
        "Automated tag removed from incoming must be dropped");
    assertTrue(resultFqns.contains("PII.Sensitive"), "Manual tag must always be kept");
  }

  @Test
  void mergeTagsWithIncomingPrecedence_keepsAllTagsWhenIncomingIsEmpty() {
    TagLabel automated =
        new TagLabel()
            .withTagFQN("Tier.Tier1")
            .withLabelType(TagLabel.LabelType.AUTOMATED)
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withState(TagLabel.State.CONFIRMED);

    List<TagLabel> existing = List.of(automated);
    List<TagLabel> result = TagLabelUtil.mergeTagsWithIncomingPrecedence(existing, null);

    assertEquals(1, result.size());
    assertEquals("Tier.Tier1", result.get(0).getTagFQN());
  }

  @Test
  void populateTagLabel_preservesAppliedByAndAppliedAt() {
    Date appliedAt = new Date();
    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash usage =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    usage.setTargetFQNHash("targetHash");
    usage.setSource(TagLabel.TagSource.CLASSIFICATION.ordinal());
    usage.setTagFQN("PersonalData.Personal");
    usage.setLabelType(TagLabel.LabelType.MANUAL.ordinal());
    usage.setState(TagLabel.State.CONFIRMED.ordinal());
    usage.setReason("test");
    usage.setAppliedBy("admin");
    usage.setAppliedAt(appliedAt);

    Map<String, List<TagLabel>> result = TagLabelUtil.populateTagLabel(List.of(usage));

    assertNotNull(result.get("targetHash"));
    assertEquals(1, result.get("targetHash").size());
    TagLabel tagLabel = result.get("targetHash").get(0);
    assertEquals("admin", tagLabel.getAppliedBy());
    assertEquals(appliedAt, tagLabel.getAppliedAt());
  }
}
