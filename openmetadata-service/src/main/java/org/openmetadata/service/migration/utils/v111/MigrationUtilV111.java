package org.openmetadata.service.migration.utils.v111;

import static org.openmetadata.service.Entity.INGESTION_PIPELINE;
import static org.openmetadata.service.Entity.TEST_CASE;
import static org.openmetadata.service.Entity.TEST_SUITE;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.FullyQualifiedName;
import org.postgresql.util.PGobject;

@Slf4j
public class MigrationUtilV111 {
  private MigrationUtilV111() {
    /* Cannot create object  util class*/
  }

  public static void removeDuplicateTestCases(
      CollectionDAO collectionDAO, Handle handle, String getSql) {
    List<Map<String, Object>> resultList = handle.createQuery(getSql).mapToMap().list();
    Map<String, String> resultMap = new HashMap<>();
    for (Map<String, Object> idMap : resultList) {
      String id1 = (String) idMap.get("id1");
      String id2 = (String) idMap.get("id2");
      if (!(resultMap.containsKey(id1) || resultMap.containsKey(id2))) {
        resultMap.put(id1, id2);
      }
    }
    resultMap.forEach(
        (k, v) -> {
          UUID id = UUID.fromString(k);

          // Get all the relationship of id1
          List<CollectionDAO.EntityRelationshipRecord> records =
              collectionDAO
                  .relationshipDAO()
                  .findTo(id, TEST_SUITE, Relationship.CONTAINS.ordinal(), TEST_CASE);

          List<CollectionDAO.EntityRelationshipRecord> ingestionRecords =
              collectionDAO
                  .relationshipDAO()
                  .findTo(id, TEST_SUITE, Relationship.CONTAINS.ordinal(), INGESTION_PIPELINE);

          for (CollectionDAO.EntityRelationshipRecord relationRecord : records) {
            UUID toId = relationRecord.getId();
            // Store the relationship to be with id2 so that the test Cases are not lost
            collectionDAO
                .relationshipDAO()
                .insert(
                    UUID.fromString(v),
                    toId,
                    TEST_SUITE,
                    TEST_CASE,
                    Relationship.CONTAINS.ordinal());
          }

          // Delete Test Suite
          try {
            collectionDAO.testSuiteDAO().delete(id);
            // Delete Relationship
            collectionDAO.relationshipDAO().deleteAllWithId(id);
          } catch (Exception ex) {
            // maybe already deleted
          }

          for (CollectionDAO.EntityRelationshipRecord relationshipRecord : ingestionRecords) {
            try {
              UUID toId = relationshipRecord.getId();
              collectionDAO.ingestionPipelineDAO().delete(toId);
              collectionDAO.relationshipDAO().deleteAllWithId(toId);
            } catch (Exception ex) {
              // maybe already deleted
            }
          }
        });
  }

  public static void runTestSuiteMigration(
      CollectionDAO collectionDAO,
      Handle handle,
      String getSql,
      String updateSql,
      String resultListSql) {
    List<Map<String, Object>> resultList = handle.createQuery(resultListSql).mapToMap().list();
    for (Map<String, Object> row : resultList) {
      Object json = row.get("json");
      if (json == null) {
        continue;
      }
      TestSuite suite = null;
      if (json instanceof String str) {
        suite = JsonUtils.readValue(str, TestSuite.class);
      } else if (json instanceof PGobject pgObject) {
        suite = JsonUtils.readValue(pgObject.getValue(), TestSuite.class);
      }
      // Only Test Suite which are executable needs to be updated
      if (Boolean.TRUE.equals(suite.getExecutable())) {
        if (suite.getExecutableEntityReference() != null) {
          updateTestSuite(handle, suite, updateSql);
        } else {
          String entityName = StringUtils.replaceOnce(suite.getDisplayName(), ".testSuite", "");
          try {
            Table table = collectionDAO.tableDAO().findEntityByName(entityName, Include.ALL);
            // Update Test Suite
            suite.setExecutable(true);
            suite.setExecutableEntityReference(table.getEntityReference());
            updateTestSuite(handle, suite, updateSql);
            removeDuplicateTestCases(collectionDAO, handle, getSql);
          } catch (Exception ex) {
            try {
              collectionDAO.testSuiteDAO().delete(suite.getId());
              // Delete Relationship
              collectionDAO.relationshipDAO().deleteAllWithId(suite.getId());
            } catch (Exception ex1) {
              // Ignore
            }
          }
        }
      }
    }
  }

  public static void updateTestSuite(Handle handle, TestSuite suite, String updateSql) {
    if (suite.getExecutableEntityReference() != null) {
      try {
        EntityReference executableEntityRef = suite.getExecutableEntityReference();
        // Run new Migrations
        suite.setName(String.format("%s.testSuite", executableEntityRef.getName()));
        suite.setFullyQualifiedName(
            String.format("%s.testSuite", executableEntityRef.getFullyQualifiedName()));
        int result =
            handle
                .createUpdate(updateSql)
                .bind("json", JsonUtils.pojoToJson(suite))
                .bind("fqnHash", FullyQualifiedName.buildHash(suite.getFullyQualifiedName()))
                .bind("id", suite.getId().toString())
                .execute();
        if (result <= 0) {
          LOG.error("No Rows Affected for 1.1.1 test suite Migration");
        }
      } catch (Exception ex) {
        LOG.error("Error in Updating Test Suite with FQN : {}", suite.getFullyQualifiedName(), ex);
        throw ex;
      }
    }
  }
}
