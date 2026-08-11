package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.util.OpenMetadataOperations.SmartReindexAction;
import org.openmetadata.service.util.OpenMetadataOperations.SmartReindexPlan;

class OpenMetadataOperationsSmartReindexTest {

  @Test
  void upgradeReindexesAllRequestedEntitiesWithoutChangedMappingFilter() {
    SmartReindexPlan plan = OpenMetadataOperations.planSmartReindex(Set.of("all"), true, List.of());

    assertEquals(SmartReindexAction.REINDEX_ALL_FOR_UPGRADE, plan.action());
    assertEquals(Set.of("all"), plan.entities());
    assertTrue(plan.shouldReindex());
    assertTrue(plan.updateVersions());
  }

  @Test
  void upgradeKeepsExplicitlyRequestedEntitiesAndIgnoresHashChanges() {
    SmartReindexPlan plan =
        OpenMetadataOperations.planSmartReindex(Set.of("table", "topic"), true, List.of("table"));

    assertEquals(SmartReindexAction.REINDEX_ALL_FOR_UPGRADE, plan.action());
    assertEquals(Set.of("table", "topic"), plan.entities());
    assertTrue(plan.shouldReindex());
    assertTrue(plan.updateVersions());
  }

  @Test
  void noUpgradeAndNoMappingChangesSkips() {
    SmartReindexPlan plan =
        OpenMetadataOperations.planSmartReindex(Set.of("all"), false, List.of());

    assertEquals(SmartReindexAction.SKIP_NO_MAPPING_CHANGES, plan.action());
    assertFalse(plan.shouldReindex());
    assertFalse(plan.updateVersions());
  }

  @Test
  void noUpgradeWithAllAndChangedMappingsReindexesOnlyChanged() {
    SmartReindexPlan plan =
        OpenMetadataOperations.planSmartReindex(
            Set.of("all"), false, List.of("table", "glossaryTerm"));

    assertEquals(SmartReindexAction.REINDEX_CHANGED, plan.action());
    assertEquals(Set.of("table", "glossaryTerm"), plan.entities());
    assertTrue(plan.shouldReindex());
    assertTrue(plan.updateVersions());
  }

  @Test
  void noUpgradeWithRequestedSubsetReindexesIntersection() {
    SmartReindexPlan plan =
        OpenMetadataOperations.planSmartReindex(
            Set.of("table", "topic"), false, List.of("table", "dashboard"));

    assertEquals(SmartReindexAction.REINDEX_CHANGED, plan.action());
    assertEquals(Set.of("table"), plan.entities());
    assertTrue(plan.shouldReindex());
  }

  @Test
  void noUpgradeWithRequestedEntitiesNoneChangedSkips() {
    SmartReindexPlan plan =
        OpenMetadataOperations.planSmartReindex(Set.of("table"), false, List.of("glossaryTerm"));

    assertEquals(SmartReindexAction.SKIP_NO_REQUESTED_CHANGES, plan.action());
    assertFalse(plan.shouldReindex());
    assertFalse(plan.updateVersions());
  }

  @Test
  void resolveChangedEntitiesForAllReturnsAllChangedMappings() {
    Set<String> resolved =
        OpenMetadataOperations.resolveChangedEntities(
            Set.of("all"), List.of("table", "topic", "glossaryTerm"));

    assertEquals(Set.of("table", "topic", "glossaryTerm"), resolved);
  }

  @Test
  void resolveChangedEntitiesForExplicitRequestReturnsIntersection() {
    Set<String> resolved =
        OpenMetadataOperations.resolveChangedEntities(
            Set.of("table", "topic"), List.of("topic", "dashboard"));

    assertEquals(Set.of("topic"), resolved);
  }

  @Test
  void resolveChangedEntitiesForExplicitRequestWithNoOverlapIsEmpty() {
    Set<String> resolved =
        OpenMetadataOperations.resolveChangedEntities(Set.of("table"), List.of("dashboard"));

    assertTrue(resolved.isEmpty());
  }
}
