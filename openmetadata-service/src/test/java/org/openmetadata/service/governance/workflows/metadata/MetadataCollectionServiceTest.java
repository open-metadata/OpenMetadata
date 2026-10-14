package org.openmetadata.service.governance.workflows.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class MetadataCollectionServiceTest {
  @ParameterizedTest
  @CsvSource({
    "experts, Experts",
    "description, Description",
    "extension.costCenter, Cost center",
    "metricExpression.code, Metric expression code"
  })
  void namesAFieldAsPeopleReadIt(final String path, final String name) {
    assertEquals(name, MetadataCollectionService.fieldName(path));
  }

  @Test
  void keepsOneTaskPerAssetAndStageNode() {
    final UUID asset = UUID.randomUUID();

    assertEquals(
        MetadataCollectionService.taskId(asset, "DomainLifecycle", "Collect0"),
        MetadataCollectionService.taskId(asset, "DomainLifecycle", "Collect0"));
    assertNotEquals(
        MetadataCollectionService.taskId(asset, "DomainLifecycle", "Collect0"),
        MetadataCollectionService.taskId(asset, "DomainLifecycle", "Collect1"));
  }
}
