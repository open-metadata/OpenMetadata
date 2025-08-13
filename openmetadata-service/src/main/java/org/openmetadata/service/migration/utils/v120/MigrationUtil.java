package org.openmetadata.service.migration.utils.v120;

import jakarta.json.Json;
import jakarta.json.JsonObject;
import jakarta.json.JsonObjectBuilder;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.QueryRepository;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.postgresql.util.PGobject;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {
    /* Cannot create object  util class*/
  }

  // Try to find the service for each of the queries by going through
  // the table service hierarchy relationships
  private static final String QUERY_LIST_SERVICE =
      "SELECT "
          + "  q.id AS query_id, "
          + "  q.json AS query_json, "
          + "  er_table_query.fromId AS table_id, "
          + "  er_schema_table.fromId AS schema_id, "
          + "  er_database_schema.fromId AS database_id, "
          + "  er_service_database.fromId AS service_id, "
          + "  db_service.name AS service_name "
          + "FROM query_entity q "
          + "LEFT JOIN entity_relationship er_table_query "
          + "  ON er_table_query.fromEntity = 'table' "
          + " AND er_table_query.toEntity = 'query' "
          + " AND er_table_query.toId = q.id "
          + "LEFT JOIN entity_relationship er_schema_table "
          + "  ON er_schema_table.fromEntity = 'databaseSchema' "
          + " AND er_schema_table.toEntity = 'table' "
          + " AND er_table_query.fromId = er_schema_table.toId "
          + "LEFT JOIN entity_relationship er_database_schema "
          + "  ON er_database_schema.fromEntity = 'database' "
          + " AND er_database_schema.toEntity = 'databaseSchema' "
          + " AND er_schema_table.fromId = er_database_schema.toId "
          + "LEFT JOIN entity_relationship er_service_database "
          + "  ON er_service_database.fromEntity = 'databaseService' "
          + " AND er_service_database.toEntity = 'database' "
          + " AND er_database_schema.fromId = er_service_database.toId "
          + "LEFT JOIN dbservice_entity db_service "
          + "  ON db_service.id = er_service_database.fromId";

  private static final String DELETE_QUERY = "DELETE FROM query_entity WHERE id = :id";
  private static final String DELETE_RELATIONSHIP =
      "DELETE FROM entity_relationship WHERE fromId = :id or toId = :id";

  private static final String GLOSSARY_TERM_LIST_QUERY = "SELECT json FROM glossary_term_entity";

  /**
   * Queries have a `queryUsedIn` field as a list of EntityRef. We'll pick up the first element of the list, since the
   * tables should normally be in the same service, and: 1. Get the table from the ID 2. Identify the service 3. Update
   * the Query.service EntityRef
   */
  public static void addQueryService(Handle handle, CollectionDAO collectionDAO) {
    QueryRepository queryRepository = (QueryRepository) Entity.getEntityRepository(Entity.QUERY);

    try {
      handle
          .createQuery(QUERY_LIST_SERVICE)
          .mapToMap()
          .forEach(
              row -> {
                try {

                  JsonObject queryJson =
                      JsonUtils.readJson((String) row.get("query_json")).asJsonObject();
                  String serviceName = (String) row.get("service_name");
                  String serviceId = (String) row.get("service_id");

                  if (serviceId == null) {
                    LOG.warn(
                        String.format(
                            "Query [%s] cannot be linked to a service. Deleting...",
                            queryJson.getString("id")));
                    // We cannot directly call the queryRepository for deletion, since the Query
                    // object is missing the new `service` property we introduced and the `delete`
                    // operation would fail. We need to delete the query entry and the relationships
                    // from/to this ID by hand. It should be OK since queries are simple structures
                    // without any children. We should only have relationship
                    // table <> query & user <> query
                    handle
                        .createUpdate(DELETE_QUERY)
                        .bind("id", queryJson.getString("id"))
                        .execute();
                    handle
                        .createUpdate(DELETE_RELATIONSHIP)
                        .bind("id", queryJson.getString("id"))
                        .execute();

                  } else {
                    // Since the query does not have the service yet, it cannot be cast to the Query
                    // class.

                    JsonObject serviceJson =
                        Json.createObjectBuilder()
                            .add("id", serviceId)
                            .add("name", serviceName)
                            .add("fullyQualifiedName", serviceName)
                            .add("type", "databaseService")
                            .build();

                    JsonObjectBuilder queryWithService = Json.createObjectBuilder();
                    queryJson.forEach(queryWithService::add);
                    queryWithService.add("service", serviceJson);

                    Query query =
                        JsonUtils.readValue(queryWithService.build().toString(), Query.class);
                    queryRepository.setFullyQualifiedName(query);
                    collectionDAO.queryDAO().update(query);
                  }
                } catch (Exception ex) {
                  LOG.warn(String.format("Error updating query [%s] due to [%s]", row, ex));
                }
              });
    } catch (Exception ex) {
      LOG.warn("Error running the query migration ", ex);
    }
  }

  /**
   * Before Release 1.2, Glossary and all the Glossary terms , even the deeply nested glossary terms have contains
   * relation with Glossary and also its parent GlossaryTerm. These causes delete issue as we recursively delete the
   * GlossaryTerms When Glossary gets deleted. We have updated the Glossary -> nested GlossaryTerm to be "Has". This
   * migration does following update 1. List all GlossaryTerms, update the status to Accepted , since we introduced the
   * Glossary Approval Workflow 2. For each term we look at who is the parent is, There should be only one parent in
   * 1.2.0 release, previous releases nested terms will have a two parents the parent GlossaryTerm and its Glossary. We
   * will update the relation to Glossary to be "Has".
   */
  public static void updateGlossaryAndGlossaryTermRelations(
      Handle handle, CollectionDAO collectionDAO) {
    GlossaryTermRepository glossaryTermRepository =
        (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
    try {
      // there is no way to list the glossary terms using repository as the relationship is broken.
      handle
          .createQuery(GLOSSARY_TERM_LIST_QUERY)
          .mapToMap()
          .forEach(
              row -> {
                String jsonRow;
                if (Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())) {
                  jsonRow = (String) row.get("json");
                } else {
                  // Postgres stores JSON as a JSONB, so we can't just cast it as a string
                  PGobject pgObject = (PGobject) row.get("json");
                  jsonRow = pgObject.getValue();
                }
                GlossaryTerm term = JsonUtils.readValue(jsonRow, GlossaryTerm.class);
                if (term.getEntityStatus() == EntityStatus.DRAFT) {
                  term.setEntityStatus(EntityStatus.APPROVED);
                  collectionDAO.glossaryTermDAO().update(term);
                }
                EntityReference glossaryRef =
                    glossaryTermRepository.getFromEntityRef(
                        term.getId(), Relationship.CONTAINS, Entity.GLOSSARY, false);
                EntityReference glossaryTermRef =
                    glossaryTermRepository.getFromEntityRef(
                        term.getId(), Relationship.CONTAINS, Entity.GLOSSARY_TERM, false);
                if (glossaryTermRef != null && glossaryRef != null) {
                  glossaryTermRepository.deleteRelationship(
                      glossaryRef.getId(),
                      Entity.GLOSSARY,
                      term.getId(),
                      Entity.GLOSSARY_TERM,
                      Relationship.CONTAINS);
                  glossaryTermRepository.addRelationship(
                      glossaryRef.getId(),
                      term.getId(),
                      Entity.GLOSSARY,
                      Entity.GLOSSARY_TERM,
                      Relationship.HAS);
                }
              });
    } catch (Exception ex) {
      LOG.warn("Error during the Glossary Term migration due to ", ex);
    }
  }
}
