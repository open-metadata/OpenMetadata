package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.schema.type.TagLabel.TagSource;

class ColumnRepositoryExportTest {

  /**
   * The column export leaves out DERIVED labels: re-importing the file would otherwise store a term
   * the column inherits from its table, or a tag a term implies, as the column's own. A label
   * propagated along lineage is the column's own and goes in.
   */
  @Test
  void columnExportLeavesOutDerivedLabels() {
    List<TagLabel> tags =
        List.of(
            label("Finance.Revenue", TagSource.GLOSSARY, LabelType.DERIVED),
            label("Finance.Cost", TagSource.GLOSSARY, LabelType.MANUAL),
            label("PII.Sensitive", TagSource.CLASSIFICATION, LabelType.DERIVED),
            label("Lineage.Upstream", TagSource.CLASSIFICATION, LabelType.PROPAGATED));

    assertEquals("Finance.Cost", ColumnRepository.formatTags(tags, false));
    assertEquals("Lineage.Upstream", ColumnRepository.formatTags(tags, true));
    assertEquals("", ColumnRepository.formatTags(null, true));
  }

  private static TagLabel label(String fqn, TagSource source, LabelType labelType) {
    return new TagLabel().withTagFQN(fqn).withSource(source).withLabelType(labelType);
  }
}
