package org.openmetadata.service.migration.utils.v1133;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {}

  private static final int BATCH_SIZE = 500;

  private static final String SELECT_BATCH =
      "SELECT id, json FROM data_contract_entity ORDER BY id LIMIT :limit OFFSET :offset";

  private static final String MYSQL_INSERT =
      "INSERT IGNORE INTO entity_relationship "
          + "(fromId, toId, fromEntity, toEntity, relation, relationType, deleted) "
          + "VALUES (:fromId, :toId, 'testSuite', 'dataContract', 0, '', 0)";

  private static final String POSTGRES_INSERT =
      "INSERT INTO entity_relationship "
          + "(fromId, toId, fromEntity, toEntity, relation, relationType, deleted) "
          + "VALUES (:fromId, :toId, 'testSuite', 'dataContract', 0, '', false) "
          + "ON CONFLICT DO NOTHING";

  public static void backfillDataContractTestSuiteRelationships(
      Handle handle, ConnectionType type) {
    LOG.info(
        "v1133: backfilling testSuite -> dataContract relationships (batchSize={})", BATCH_SIZE);
    String insertSql = type == ConnectionType.MYSQL ? MYSQL_INSERT : POSTGRES_INSERT;
    int offset = 0;
    int totalScanned = 0;
    int totalInserted = 0;
    while (true) {
      int scannedInBatch;
      int insertedInBatch = 0;
      try {
        List<Map<String, Object>> rows =
            handle
                .createQuery(SELECT_BATCH)
                .bind("limit", BATCH_SIZE)
                .bind("offset", offset)
                .mapToMap()
                .list();
        scannedInBatch = rows.size();
        for (Map<String, Object> row : rows) {
          Object contractId = firstNonNull(row, "id", "ID");
          Object jsonBlob = firstNonNull(row, "json", "JSON");
          if (contractId == null || jsonBlob == null) {
            continue;
          }
          String testSuiteId = extractTestSuiteId(jsonBlob.toString());
          if (testSuiteId == null) {
            continue;
          }
          try {
            int rc =
                handle
                    .createUpdate(insertSql)
                    .bind("fromId", testSuiteId)
                    .bind("toId", contractId.toString())
                    .execute();
            insertedInBatch += rc;
          } catch (Exception e) {
            LOG.warn(
                "v1133: failed to insert relationship testSuite={} -> dataContract={}: {}",
                testSuiteId,
                contractId,
                e.getMessage());
          }
        }
      } catch (Exception e) {
        LOG.error("v1133: batch at offset={} failed, aborting backfill", offset, e);
        break;
      }
      totalScanned += scannedInBatch;
      totalInserted += insertedInBatch;
      LOG.info(
          "v1133: batch offset={} scanned={} inserted={} (running totals scanned={} inserted={})",
          offset,
          scannedInBatch,
          insertedInBatch,
          totalScanned,
          totalInserted);
      if (scannedInBatch < BATCH_SIZE) {
        break;
      }
      offset += BATCH_SIZE;
    }
    LOG.info(
        "v1133: backfill complete, totalScanned={} totalInserted={}", totalScanned, totalInserted);
  }

  private static Object firstNonNull(Map<String, Object> row, String... keys) {
    Object hit = null;
    for (String k : keys) {
      Object v = row.get(k);
      if (v != null) {
        hit = v;
        break;
      }
    }
    return hit;
  }

  private static String extractTestSuiteId(String contractJson) {
    String id = null;
    try {
      JsonNode node = JsonUtils.readTree(contractJson);
      if (node != null) {
        JsonNode testSuite = node.get("testSuite");
        if (testSuite != null) {
          JsonNode idNode = testSuite.get("id");
          if (idNode != null && !idNode.isNull()) {
            id = idNode.asText();
          }
        }
      }
    } catch (Exception e) {
      LOG.warn("v1133: failed to parse data_contract JSON: {}", e.getMessage());
    }
    return id;
  }
}
