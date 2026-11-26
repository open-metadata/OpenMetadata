package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.IndexMappingVersionTracker;
import org.openmetadata.service.search.SearchRepository;
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

  @Test
  void theSmartReindexReadsTheVectorFieldsBeforeItPlans() throws Exception {
    OpenMetadataOperations operations = new OpenMetadataOperations();
    SearchRepository searchRepository = mock(SearchRepository.class);
    setField(operations, "searchRepository", searchRepository);
    setField(operations, "collectionDAO", mock(CollectionDAO.class));
    AppRepository appRepository = mock(AppRepository.class);
    when(appRepository.getByName(any(), any(), any())).thenReturn(new App());

    int result;
    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedConstruction<IndexMappingVersionTracker> ignored =
            mockConstruction(
                IndexMappingVersionTracker.class,
                (tracker, construction) ->
                    when(tracker.getChangedMappings())
                        .thenAnswer(
                            call -> {
                              ((Supplier<?>) construction.arguments().get(3)).get();
                              return List.of();
                            }))) {
      entity.when(() -> Entity.getEntityRepository(Entity.APPLICATION)).thenReturn(appRepository);
      result = runSearchReindexApp(operations);
    }

    assertEquals(0, result, "nothing to rebuild, so the reindex is skipped");
    InOrder order = inOrder(searchRepository);
    order.verify(searchRepository).checkVectorFields();
    order.verify(searchRepository).vectorIndexRebuilds();
  }

  private static int runSearchReindexApp(OpenMetadataOperations operations) throws Exception {
    Method method =
        OpenMetadataOperations.class.getDeclaredMethod(
            "executeSearchReindexApp",
            String.class,
            Set.class,
            int.class,
            long.class,
            int.class,
            int.class,
            int.class,
            int.class,
            int.class,
            int.class,
            int.class,
            boolean.class,
            boolean.class,
            String.class,
            String.class);
    method.setAccessible(true);
    return (int)
        method.invoke(
            operations,
            "SearchIndexingApplication",
            Set.of("all"),
            100,
            1L,
            1,
            1,
            1,
            1,
            1,
            1,
            1,
            false,
            false,
            null,
            null);
  }

  private static void setField(Object target, String name, Object value) throws Exception {
    Field field = OpenMetadataOperations.class.getDeclaredField(name);
    field.setAccessible(true);
    field.set(target, value);
  }
}
