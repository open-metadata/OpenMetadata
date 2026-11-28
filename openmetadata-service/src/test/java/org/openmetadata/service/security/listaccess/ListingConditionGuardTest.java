package org.openmetadata.service.security.listaccess;

import static java.util.stream.Collectors.toSet;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.classgraph.ClassGraph;
import io.github.classgraph.ScanResult;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DataAssetServiceDAOs;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQueryContainer;

/**
 * A row condition names the listed table, so a listing query splices its condition into a SELECT
 * that reads the table under its own name. A type RowStorages does not cover renders no reference
 * to its table, so its DAO may alias the table until the type is covered.
 */
class ListingConditionGuardTest {
  private static final Pattern CONDITION =
      Pattern.compile(
          "<(?:cond|condition|sqlCondition|mysqlCond|postgresCond|psqlCond|outerCond)>");
  private static final Pattern ALIASED_TABLE =
      Pattern.compile(
          "\\s+<table>\\s+(?:AS\\s+)?(?!(?:WHERE|ORDER|GROUP|LIMIT|INNER|LEFT|RIGHT|JOIN|CROSS)\\b)"
              + "[A-Za-z_]",
          Pattern.CASE_INSENSITIVE);
  private static final Pattern FROM = Pattern.compile("\\bFROM\\b", Pattern.CASE_INSENSITIVE);
  private static final Map<Class<?>, String> ALIASING_UNCOVERED_DAOS =
      Map.of(
          DataAssetServiceDAOs.DirectoryDAO.class, Entity.DIRECTORY,
          DataAssetServiceDAOs.FileDAO.class, Entity.FILE,
          DataAssetServiceDAOs.SpreadsheetDAO.class, Entity.SPREADSHEET);

  @Test
  void onlyDaosOfUncoveredTypesSpliceAConditionBesideTheirAliasedTable() {
    Set<Class<?>> daos = entityDaos();
    assertTrue(daos.contains(EntityDAO.class), "the scan found only " + daos.size() + " DAOs");

    Set<Class<?>> aliasing =
        daos.stream().filter(ListingConditionGuardTest::aliasesTheConditionsTable).collect(toSet());

    assertEquals(ALIASING_UNCOVERED_DAOS.keySet(), aliasing);
  }

  @Test
  void noTypeWhoseDaoAliasesTheConditionsTableIsCovered() {
    assertEquals(
        List.of(),
        ALIASING_UNCOVERED_DAOS.values().stream().filter(RowStorages::covers).toList(),
        "read the table under its own name where the DAO splices the condition, then cover it");
  }

  private static boolean aliasesTheConditionsTable(Class<?> dao) {
    return Arrays.stream(dao.getDeclaredMethods())
        .flatMap(ListingConditionGuardTest::queries)
        .anyMatch(ListingConditionGuardTest::splicesBesideAnAliasedTable);
  }

  private static boolean splicesBesideAnAliasedTable(String sql) {
    Matcher condition = CONDITION.matcher(sql);
    boolean aliased = false;
    while (!aliased && condition.find()) {
      String select = enclosingSelect(sql, condition.start());
      Matcher from = FROM.matcher(select);
      aliased =
          from.find()
              && ALIASED_TABLE.matcher(select).region(from.end(), select.length()).lookingAt();
    }
    return aliased;
  }

  /** The text of the SELECT around {@code position}, without the subqueries nested in it. */
  private static String enclosingSelect(String sql, int position) {
    StringBuilder reversed = new StringBuilder();
    int depth = 0;
    for (int i = position - 1; i >= 0 && depth >= 0; i--) {
      char character = sql.charAt(i);
      depth +=
          switch (character) {
            case ')' -> 1;
            case '(' -> -1;
            default -> 0;
          };
      if (depth == 0 && character != ')') {
        reversed.append(character);
      }
    }
    return reversed.reverse().toString();
  }

  private static Set<Class<?>> entityDaos() {
    Set<Class<?>> daos = new HashSet<>();
    try (ScanResult scan =
        new ClassGraph()
            .enableAnnotationInfo()
            .enableMethodInfo()
            .ignoreClassVisibility()
            .acceptPackages("org.openmetadata", "io.collate")
            .scan()) {
      Stream.of(
              scan.getClassesWithMethodAnnotation(SqlQuery.class),
              scan.getClassesWithMethodAnnotation(ConnectionAwareSqlQuery.class),
              scan.getClassesWithMethodAnnotation(ConnectionAwareSqlQueryContainer.class))
          .flatMap(classes -> classes.loadClasses().stream())
          .filter(EntityDAO.class::isAssignableFrom)
          .forEach(daos::add);
    }
    return daos;
  }

  private static Stream<String> queries(Method method) {
    return Stream.concat(
        Stream.ofNullable(method.getAnnotation(SqlQuery.class)).map(SqlQuery::value),
        Stream.of(method.getAnnotationsByType(ConnectionAwareSqlQuery.class))
            .map(ConnectionAwareSqlQuery::value));
  }
}
