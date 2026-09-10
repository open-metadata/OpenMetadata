package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;

class ColumnCoverageTest {
  @Test
  void nestedColumnsUseTheSameDenominatorForEveryCoverageCounter() {
    Column leaf =
        new Column()
            .withDescription("documented")
            .withTags(
                List.of(
                    new TagLabel().withSource(TagSource.GLOSSARY).withTagFQN("Business.Customer"),
                    new TagLabel()
                        .withSource(TagSource.CLASSIFICATION)
                        .withTagFQN("PII.NonSensitive")));
    Column parent = new Column().withDescription(" ").withChildren(List.of(leaf));
    Column sibling =
        new Column()
            .withDescription("documented")
            .withTags(List.of(new TagLabel().withTagFQN("Tier.Tier1"), new TagLabel()));

    assertEquals(new ColumnCoverage(3, 2, 1, 1), ColumnCoverage.from(List.of(parent, sibling)));
  }

  @Test
  void anEntityWithoutColumnsHasZeroMeasuredColumns() {
    assertEquals(new ColumnCoverage(0, 0, 0, 0), ColumnCoverage.from(null));
    assertEquals(new ColumnCoverage(0, 0, 0, 0), ColumnCoverage.from(List.of()));
  }

  @Test
  void duplicateLabelsCountAColumnOnlyOnce() {
    TagLabel glossary = new TagLabel().withSource(TagSource.GLOSSARY);
    TagLabel pii = new TagLabel().withTagFQN("pii.Sensitive");
    Column column = new Column().withTags(List.of(glossary, glossary, pii, pii));

    assertEquals(new ColumnCoverage(1, 0, 1, 1), ColumnCoverage.from(List.of(column)));
  }
}
