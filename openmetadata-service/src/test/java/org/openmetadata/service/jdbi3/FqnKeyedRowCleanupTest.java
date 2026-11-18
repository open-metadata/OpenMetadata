package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.RETURNS_DEFAULTS;
import static org.mockito.Mockito.mock;
import static org.openmetadata.service.jdbi3.FqnKeyedRowCleanup.MAX_KEPT_SUBTREES;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlStatements;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.FqnKeyedRowCleanup.EntityTable;
import org.openmetadata.service.jdbi3.FqnKeyedRowCleanup.OwnedRows;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * The rules that decide which rows a hard delete keeps, and the statements the cleanup sends to
 * each database. {@code HardDeleteCleanupIT} runs those statements against MySQL and Postgres.
 */
class FqnKeyedRowCleanupTest {
  private static final String FQN = "svc";
  private static final String HASH = FullyQualifiedName.buildHash(FQN);
  private static final List<EntityTable> TABLES =
      List.of(
          new EntityTable("table_entity", "fqnHash"),
          new EntityTable("database_service_entity", "nameHash"));

  private final List<String> preparedSql = new ArrayList<>();
  private final List<Object> boundValues = new ArrayList<>();

  @Test
  void anFqnNothingNestsUnderOwnsAllItsRows() {
    assertEquals(OwnedRows.ALL, OwnedRows.keeping(List.of()));
  }

  @Test
  void theSubtreesOfEntitiesNestedUnderAnFqnAreKept() {
    String model = HASH + ".m1";
    String otherModel = HASH + ".m2";

    assertEquals(
        new OwnedRows(true, true, List.of(model, otherModel)),
        OwnedRows.keeping(List.of(model + ".c1", otherModel, model)));
  }

  @Test
  void pastTheCapOnlyTheRowsAtTheFqnAreRemoved() {
    List<String> nested =
        IntStream.rangeClosed(0, MAX_KEPT_SUBTREES).mapToObj(index -> HASH + ".m" + index).toList();

    assertEquals(OwnedRows.AT_FQN_ONLY, OwnedRows.keeping(nested));
    assertEquals(
        MAX_KEPT_SUBTREES,
        OwnedRows.keeping(nested.subList(0, MAX_KEPT_SUBTREES)).keptSubtreeHashes().size());
  }

  @Test
  void anFqnCanNestUnderEachShorterRunOfItsSegments() {
    assertEquals(List.of("a", "a.b"), FqnKeyedRowCleanup.properPrefixes("a.b.c"));
    assertEquals(List.of(), FqnKeyedRowCleanup.properPrefixes("a"));
  }

  @Test
  void outermostDropsHashesThatNestUnderAnother() {
    assertEquals(
        List.of("a", "ab"), FqnKeyedRowCleanup.outermost(List.of("ab", "a.x", "a", "a.x.y", "a")));
  }

  @Test
  void outsideKeptSubtreesKeepsTheRowsAtAndUnderEachKeptSubtree() {
    Map<String, String> bindings = new HashMap<>();

    String condition =
        FqnKeyedRowCleanup.outsideKeptSubtrees("targetFQNHash", List.of("a.b", "a.c"), bindings);

    assertEquals(
        " AND NOT (targetFQNHash = :kept0 OR targetFQNHash LIKE :keptUnder0"
            + " OR targetFQNHash = :kept1 OR targetFQNHash LIKE :keptUnder1)",
        condition);
    assertEquals(
        Map.of("kept0", "a.b", "keptUnder0", "a.b.%", "kept1", "a.c", "keptUnder1", "a.c.%"),
        bindings);
    assertEquals(
        "", FqnKeyedRowCleanup.outsideKeptSubtrees("targetFQNHash", List.of(), new HashMap<>()));
  }

  @ParameterizedTest
  @EnumSource(ConnectionType.class)
  void theNamesakeProbeLooksUpEveryHashInEachTable(ConnectionType database) {
    Map<String, String> bindings = new LinkedHashMap<>();
    bindings.put("hash0", "h0");
    bindings.put("hash1", "h1");

    tagUsage(database)
        .listEntityFqnHashes(FqnKeyedRowCleanup.inProbes(TABLES, bindings.keySet()), bindings);

    assertEquals(
        List.of(
            "SELECT probe.hash FROM ("
                + "(SELECT fqnHash AS hash FROM table_entity WHERE fqnHash IN (?, ?)) UNION ALL "
                + "(SELECT nameHash AS hash FROM database_service_entity WHERE nameHash IN (?, ?))"
                + ") probe"),
        preparedSql);
    assertEquals(List.of("h0", "h1", "h0", "h1"), boundValues);
  }

  @ParameterizedTest
  @EnumSource(ConnectionType.class)
  void theNestedProbesLookUnderEachPrefixAndCapEachTable(ConnectionType database) {
    Map<String, String> prefixes = new LinkedHashMap<>();
    prefixes.put("under0", "a.%");
    prefixes.put("under1", "b.%");
    List<EntityTable> table = TABLES.subList(0, 1);

    tagUsage(database)
        .listEntityFqnHashes(FqnKeyedRowCleanup.anyUnderProbes(table, prefixes.keySet()), prefixes);
    tagUsage(database)
        .listEntityFqnHashes(
            FqnKeyedRowCleanup.allUnderProbes(table, "under", MAX_KEPT_SUBTREES + 1),
            Map.of("under", "a.%"));

    assertEquals(
        List.of(
            "SELECT probe.hash FROM ((SELECT fqnHash AS hash FROM table_entity"
                + " WHERE (fqnHash LIKE ? OR fqnHash LIKE ?) LIMIT 1)) probe",
            "SELECT probe.hash FROM ((SELECT fqnHash AS hash FROM table_entity"
                + " WHERE fqnHash LIKE ? LIMIT 101)) probe"),
        preparedSql);
    assertEquals(List.of("a.%", "b.%", "a.%"), boundValues);
  }

  @ParameterizedTest
  @EnumSource(ConnectionType.class)
  void theTagDeleteKeepsTheRowsAtAndUnderEachKeptSubtree(ConnectionType database) {
    tagUsage(database).deleteTagLabelsByTargetPrefixOutside(FQN, List.of("k"));

    String orderBy = database == ConnectionType.MYSQL ? " ORDER BY tagFQN" : "";
    assertEquals(
        List.of(
            "DELETE FROM tag_usage WHERE (targetFQNHash = ? OR targetFQNHash LIKE ?)"
                + " AND NOT (targetFQNHash = ? OR targetFQNHash LIKE ?)"
                + orderBy),
        preparedSql);
    assertEquals(List.of(HASH, HASH + ".%", "k", "k.%"), boundValues);
  }

  @ParameterizedTest
  @EnumSource(ConnectionType.class)
  void theFieldRelationshipDeleteKeepsTheRowsAtAndUnderEachKeptSubtree(ConnectionType database) {
    dao(database, CoreRelationshipDAOs.FieldRelationshipDAO.class)
        .deleteAllByPrefixOutside(FQN, Entity.TABLE, List.of("k"));

    assertEquals(
        List.of(
            "DELETE from field_relationship WHERE"
                + " ((toFQNHash LIKE ? AND NOT (toFQNHash = ? OR toFQNHash LIKE ?))"
                + " OR (fromFQNHash LIKE ? AND NOT (fromFQNHash = ? OR fromFQNHash LIKE ?)))"
                + " AND fromType <> ? AND toType <> ?"),
        preparedSql);
    assertEquals(
        List.of(HASH + ".%", "k", "k.%", HASH + ".%", "k", "k.%", Entity.TYPE, Entity.TYPE),
        boundValues);
  }

  private ClassificationTagDAOs.TagUsageDAO tagUsage(ConnectionType database) {
    return dao(database, ClassificationTagDAOs.TagUsageDAO.class);
  }

  /** The DAO on JDBI as JdbiUtils sets it up, over a connection that records what it is sent. */
  private <D> D dao(ConnectionType database, Class<D> daoClass) {
    ResultSet noRows = mock(ResultSet.class);
    PreparedStatement statement =
        mock(
            PreparedStatement.class,
            call -> {
              String method = call.getMethod().getName();
              if (method.startsWith("set") && call.getArguments().length == 2) {
                boundValues.add(call.getArgument(1));
              }
              return method.equals("getResultSet") || method.equals("executeQuery")
                  ? noRows
                  : RETURNS_DEFAULTS.answer(call);
            });
    Connection connection =
        mock(
            Connection.class,
            call -> {
              if (call.getMethod().getName().equals("prepareStatement")) {
                preparedSql.add(call.getArgument(0));
                return statement;
              }
              return RETURNS_DEFAULTS.answer(call);
            });
    Jdbi jdbi = Jdbi.create(() -> connection).installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlStatements.class).setUnusedBindingAllowed(true);
    jdbi.getConfig(SqlObjects.class)
        .setSqlLocator(new ConnectionAwareAnnotationSqlLocator(database.label));
    return jdbi.onDemand(daoClass);
  }
}
