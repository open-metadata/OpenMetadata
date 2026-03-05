package org.openmetadata.service.resources.tags;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.Date;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.jdbi3.CollectionDAO;

class TagLabelUtilTest {

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
