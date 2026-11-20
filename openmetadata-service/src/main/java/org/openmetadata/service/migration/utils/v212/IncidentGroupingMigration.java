package org.openmetadata.service.migration.utils.v212;

import java.sql.SQLException;
import java.util.List;
import org.jdbi.v3.core.Handle;

/** Backfills compact grouping lookups while source-row locks serialize concurrent metadata writes. */
public final class IncidentGroupingMigration {
  private static final int BATCH_SIZE = 1000;
  private static final String DEFINITION_FILTER =
      "fromEntity = 'testDefinition' AND toEntity = 'testCase' AND relation = 0";

  private IncidentGroupingMigration() {}

  public static void backfill(Handle handle) {
    backfillCases(handle);
    backfillDefinitions(handle);
  }

  private static void backfillCases(Handle handle) {
    String after = "";
    List<String> keys;
    while (!(keys =
            handle
                .createQuery(
                    "SELECT fqnHash FROM test_case WHERE fqnHash > :after ORDER BY fqnHash LIMIT :limit")
                .bind("after", after)
                .bind("limit", BATCH_SIZE)
                .mapTo(String.class)
                .list())
        .isEmpty()) {
      final List<String> batch = keys;
      handle.useTransaction(transaction -> copyCases(transaction, batch));
      after = keys.getLast();
    }
  }

  private static void copyCases(Handle handle, List<String> keys) {
    final var rows =
        handle
            .createQuery(
                "SELECT id, fqnHash, entityFQN, entityLink, deleted FROM test_case WHERE fqnHash IN (<keys>) ORDER BY fqnHash FOR UPDATE")
            .bindList("keys", keys)
            .map(
                (result, context) ->
                    new CaseRow(
                        result.getString("id"),
                        result.getString("fqnHash"),
                        result.getString("entityFQN"),
                        result.getString("entityLink"),
                        result.getObject("deleted", Boolean.class)))
            .list();
    final var batch =
        handle.prepareBatch(
            "INSERT INTO test_case_incident_dimension (id, fqnHash, entityFQN, tableFqn, deleted) VALUES (:id, :hash, :entity, :table, :deleted)"
                + caseConflict(handle));
    for (var row : rows) {
      final String link = row.entityLink();
      batch
          .bind("id", row.id())
          .bind("hash", row.fqnHash())
          .bind("entity", row.entityFQN())
          .bind("table", tableFqn(link))
          .bind("deleted", row.deleted())
          .add();
    }
    if (!rows.isEmpty()) batch.execute();
  }

  private static String tableFqn(String entityLink) {
    final String field = entityLink.split("::", -1)[2];
    int end = field.length();
    while (end > 0 && field.charAt(end - 1) == '>') end--;
    return field.substring(0, end);
  }

  private static void backfillDefinitions(Handle handle) {
    String after = "";
    List<String> ids;
    while (!(ids =
            handle
                .createQuery(
                    "SELECT DISTINCT toId FROM entity_relationship WHERE "
                        + DEFINITION_FILTER
                        + " AND toId > :after ORDER BY toId LIMIT :limit")
                .bind("after", after)
                .bind("limit", BATCH_SIZE)
                .mapTo(String.class)
                .list())
        .isEmpty()) {
      final List<String> batch = ids;
      handle.useTransaction(transaction -> copyDefinitions(transaction, batch));
      after = ids.getLast();
    }
  }

  private static void copyDefinitions(Handle handle, List<String> ids) {
    final var rows =
        handle
            .createQuery(
                "SELECT fromId, toId, relationType FROM entity_relationship WHERE "
                    + DEFINITION_FILTER
                    + " AND toId IN (<ids>) ORDER BY toId, fromId, relationType FOR UPDATE")
            .bindList("ids", ids)
            .map(
                (result, context) ->
                    new DefinitionRow(
                        result.getString("fromId"),
                        result.getString("toId"),
                        result.getString("relationType")))
            .list();
    final var batch =
        handle.prepareBatch(
            "INSERT INTO test_case_incident_definition (fromId, toId, relationType) VALUES (:from, :to, :type)"
                + (isMysql(handle)
                    ? " ON DUPLICATE KEY UPDATE fromId = VALUES(fromId)"
                    : " ON CONFLICT DO NOTHING"));
    for (var row : rows) {
      batch
          .bind("from", row.fromId())
          .bind("to", row.toId())
          .bind("type", row.relationType())
          .add();
    }
    if (!rows.isEmpty()) batch.execute();
  }

  private static String caseConflict(Handle handle) {
    return isMysql(handle)
        ? " ON DUPLICATE KEY UPDATE id=VALUES(id), entityFQN=VALUES(entityFQN), tableFqn=VALUES(tableFqn), deleted=VALUES(deleted)"
        : " ON CONFLICT (fqnHash) DO UPDATE SET id=EXCLUDED.id, entityFQN=EXCLUDED.entityFQN, tableFqn=EXCLUDED.tableFqn, deleted=EXCLUDED.deleted";
  }

  private static boolean isMysql(Handle handle) {
    try {
      return handle.getConnection().getMetaData().getDatabaseProductName().equals("MySQL");
    } catch (SQLException exception) {
      throw new IllegalStateException("Cannot determine grouping migration SQL dialect", exception);
    }
  }

  private record CaseRow(
      String id, String fqnHash, String entityFQN, String entityLink, Boolean deleted) {}

  private record DefinitionRow(String fromId, String toId, String relationType) {}
}
