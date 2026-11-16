package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.ResourceRegistry;
import org.openmetadata.service.util.EntityUtil.Fields;

class ViewOperationsTest {
  private static final String TYPE = "viewOperationsTestType";

  @BeforeAll
  static void registerFieldOperations() {
    ResourceRegistry.entityFieldToViewOperation(
        TYPE,
        Map.of(
            "owners", MetadataOperation.VIEW_BASIC,
            "customMetrics", MetadataOperation.VIEW_TESTS,
            "usageSummary", MetadataOperation.VIEW_USAGE));
  }

  @Test
  void noFieldsNeedViewBasic() {
    assertEquals(List.of(MetadataOperation.VIEW_BASIC), ViewOperations.forFields(TYPE, fields()));
    assertEquals(List.of(MetadataOperation.VIEW_BASIC), ViewOperations.forFields(TYPE, null));
  }

  @Test
  void mappedFieldsNeedTheirOperations() {
    assertEquals(
        Set.of(MetadataOperation.VIEW_BASIC, MetadataOperation.VIEW_TESTS),
        Set.copyOf(ViewOperations.forFields(TYPE, fields("owners", "customMetrics"))));
  }

  @Test
  void anUnmappedFieldNeedsViewAll() {
    assertEquals(
        List.of(MetadataOperation.VIEW_ALL),
        ViewOperations.forFields(TYPE, fields("owners", "tableProfilerConfig")));
  }

  @Test
  void aTypeNoResourceRegisteredNeedsViewAllForAnyField() {
    assertEquals(
        List.of(MetadataOperation.VIEW_ALL),
        ViewOperations.forFields("notARegisteredType", fields("owners")));
  }

  private static Fields fields(String... names) {
    return new Fields(Set.of(names));
  }
}
