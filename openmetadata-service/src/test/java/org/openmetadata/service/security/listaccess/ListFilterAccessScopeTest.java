package org.openmetadata.service.security.listaccess;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.classgraph.ClassGraph;
import io.github.classgraph.ClassInfo;
import io.github.classgraph.ScanResult;
import java.lang.reflect.Constructor;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.BoundedListFilter;
import org.openmetadata.service.jdbi3.DaoListFilter;
import org.openmetadata.service.jdbi3.LearningResourceRepository.LearningResourceFilter;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.security.listaccess.RowPredicate.NoDomain;
import org.openmetadata.service.security.listaccess.ValueSource.Absent;
import org.openmetadata.service.security.listaccess.ValueSource.Own;

/** Every list filter appends the caller's scope, so no listing built on one returns other rows. */
class ListFilterAccessScopeTest {
  private static final RowStorage TABLES =
      new RowStorage(
          Entity.TABLE, "table_entity", "fqnHash", new Absent(), new Own(), new Absent(), false);
  private static final CallerScope UNDOMAINED_ROWS =
      CallerScope.compiled(
          TABLES, RowFilter.of(new NoDomain()), List.of(MetadataOperation.VIEW_BASIC));
  private static final String UNDOMAINED_SQL =
      "(NOT EXISTS (SELECT 1 FROM entity_relationship la1 WHERE la1.toId = table_entity.id"
          + " AND la1.toEntity = 'table' AND la1.relation = 10 AND la1.deleted = FALSE"
          + " AND la1.fromEntity = 'domain'))";

  private static final Map<Class<?>, Object> NEUTRAL_VALUES =
      Map.of(
          Include.class,
          Include.NON_DELETED,
          String.class,
          "zzz",
          boolean.class,
          false,
          int.class,
          0,
          long.class,
          0L);

  @Test
  void eachListFilterAppendsTheScope() {
    List<ListFilter> filters =
        List.of(
            new ListFilter(Include.NON_DELETED),
            new DaoListFilter(Include.NON_DELETED),
            new BoundedListFilter(Include.NON_DELETED, "zzz", "id"),
            new LearningResourceFilter(Include.NON_DELETED));
    for (ListFilter filter : filters) {
      String condition = filter.withAccessScope(UNDOMAINED_ROWS).getCondition("table_entity");
      assertTrue(
          condition.contains(UNDOMAINED_SQL),
          filter.getClass().getSimpleName() + " left out the scope: " + condition);
    }
  }

  @Test
  void aQueryThatNamesNoAliasQualifiesTheScopeWithItsTable() {
    ListFilter filter = new ListFilter(Include.ALL).withAccessScope(UNDOMAINED_ROWS);

    assertEquals("WHERE " + UNDOMAINED_SQL, filter.getConditionForEntity("table_entity"));
  }

  @Test
  void aCopyForAQueryThatAppliesOneParameterItselfKeepsTheScope() {
    ListFilter filter =
        new ListFilter(Include.NON_DELETED)
            .addQueryParam("status", "Failed")
            .addQueryParam("exampleParam", "kept")
            .withAccessScope(UNDOMAINED_ROWS);

    ListFilter copy = filter.copyWithoutQueryParam("status");

    assertNull(copy.getQueryParam("status"));
    assertEquals("kept", copy.getQueryParam("exampleParam"));
    assertEquals("Failed", filter.getQueryParam("status"));
    assertTrue(copy.getConditionForEntity("table_entity").contains(UNDOMAINED_SQL));
  }

  @Test
  void onlyAScopeThatFiltersRowsKeepsItsCountOutOfTheSharedCache() {
    assertFalse(new ListFilter().isScopedToCaller());
    assertFalse(new ListFilter().withAccessScope(CallerScope.allRows()).isScopedToCaller());
    assertTrue(new ListFilter().withAccessScope(UNDOMAINED_ROWS).isScopedToCaller());
  }

  @Test
  void everyListFilterSubclassThatBuildsItsOwnConditionAppendsTheScope() {
    List<Class<ListFilter>> subclasses = productListFilterSubclasses();
    assertTrue(
        subclasses.contains(DaoListFilter.class),
        "the scan found only " + subclasses.size() + " subclasses");

    List<String> problems = new ArrayList<>();
    for (Class<ListFilter> subclass : subclasses) {
      if (!declaresCondition(subclass)) {
        continue;
      }
      ListFilter filter = construct(subclass, problems);
      if (filter != null) {
        String condition = filter.withAccessScope(UNDOMAINED_ROWS).getCondition("table_entity");
        if (!condition.contains(UNDOMAINED_SQL)) {
          problems.add(
              subclass.getName()
                  + " builds its own condition without the access scope: append"
                  + " getAccessScopeCondition(tableName) to it, as ListFilter.getCondition does");
        }
      }
    }

    assertEquals(List.of(), problems);
  }

  private static boolean declaresCondition(Class<?> type) {
    return Arrays.stream(type.getDeclaredMethods())
        .anyMatch(method -> method.getName().equals("getCondition") && !method.isSynthetic());
  }

  private static List<Class<ListFilter>> productListFilterSubclasses() {
    try (ScanResult scan =
        new ClassGraph()
            .ignoreClassVisibility()
            .acceptPackages("org.openmetadata", "io.collate")
            .scan()) {
      return scan.getSubclasses(ListFilter.class).stream()
          .filter(info -> !isTestClass(info))
          .map(info -> info.loadClass(ListFilter.class))
          .sorted(Comparator.comparing(Class::getName))
          .toList();
    }
  }

  private static boolean isTestClass(ClassInfo info) {
    return String.valueOf(info.getClasspathElementURI()).contains("test-classes");
  }

  /** Builds the subclass from its simplest constructor, giving each parameter a neutral value. */
  private static ListFilter construct(Class<ListFilter> type, List<String> problems) {
    Constructor<?> constructor =
        Arrays.stream(type.getDeclaredConstructors())
            .min(Comparator.comparingInt(Constructor::getParameterCount))
            .orElseThrow();
    try {
      constructor.setAccessible(true);
      Object[] arguments =
          Arrays.stream(constructor.getParameterTypes())
              .map(ListFilterAccessScopeTest::neutralValue)
              .toArray();
      return (ListFilter) constructor.newInstance(arguments);
    } catch (ReflectiveOperationException | RuntimeException e) {
      problems.add(
          type.getName()
              + " cannot be built by this test ("
              + e
              + "): give it a constructor of Include, String, boolean and number parameters, or"
              + " extend neutralValue for its parameter types");
      return null;
    }
  }

  private static Object neutralValue(Class<?> type) {
    return NEUTRAL_VALUES.get(type);
  }
}
