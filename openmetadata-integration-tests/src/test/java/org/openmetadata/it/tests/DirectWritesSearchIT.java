package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.SearchDocs.awaitDoc;
import static org.openmetadata.it.util.SearchDocs.awaitNoDoc;
import static org.openmetadata.it.util.SearchDocs.refOf;
import static org.openmetadata.it.util.SearchDocs.tagFqns;
import static org.openmetadata.it.util.SearchDocs.tagFqnsOf;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TeamHierarchyTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.BulkApi;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateStoredProcedure;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.StoredProcedureCode;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModel;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.StoredProcedureLanguage;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkDeleteStaleRequest;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Writes that change an entity outside its regular update path have to leave a complete search
 * document behind: one that shows the change, keeps the fields the write did not touch, and keeps
 * what the entity inherits.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DirectWritesSearchIT {

  private static final String TABLE_INDEX = "table_search_index";
  private static final String SENSITIVE = "PII.Sensitive";
  private static final String PERSONAL = "PersonalData.Personal";

  @Test
  void recursiveSoftDeleteAndRestore_keepWhatTheTablesInherit(TestNamespace ns) {
    Domain domain = TeamHierarchyTestFactory.domain(ns, "subtree");
    User owner = UserTestFactory.createUser(ns, "schemaowner");
    DatabaseSchema schema = schema(ns);
    DatabaseSchema edited =
        client().databaseSchemas().get(schema.getId().toString(), "owners,domains");
    edited.setOwners(List.of(reference(owner.getId(), "user")));
    edited.setDomains(List.of(reference(domain.getId(), "domain")));
    client().databaseSchemas().update(schema.getId().toString(), edited);
    Table table = table(schema, "inheriting", List.of(), List.of());
    awaitDoc(TABLE_INDEX, table.getId(), doc -> inherits(doc, domain, owner));

    client().databaseSchemas().delete(schema.getId().toString(), Map.of("recursive", "true"));
    JsonNode deleted = awaitDoc(TABLE_INDEX, table.getId(), doc -> doc.path("deleted").asBoolean());
    assertTrue(inherits(deleted, domain, owner), deleted.toString());

    client().databaseSchemas().restore(schema.getId().toString());
    JsonNode restored =
        awaitDoc(TABLE_INDEX, table.getId(), doc -> !doc.path("deleted").asBoolean());
    assertTrue(inherits(restored, domain, owner), restored.toString());
  }

  @Test
  void vote_keepsTheRestOfTheDocument(TestNamespace ns) {
    User owner = UserTestFactory.createUser(ns, "voted");
    Table table =
        table(
            schema(ns),
            "voted",
            List.of(reference(owner.getId(), "user")),
            List.of(label(SENSITIVE)));
    awaitDoc(TABLE_INDEX, table.getId(), doc -> tagFqns(doc).contains(SENSITIVE));

    client()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/tables/" + table.getId() + "/vote",
            new VoteRequest().withUpdatedVoteType(VoteRequest.VoteType.VOTED_UP));

    JsonNode doc =
        awaitDoc(TABLE_INDEX, table.getId(), d -> d.path("votes").path("upVotes").asInt() == 1);
    assertAll(
        () -> assertEquals(1, doc.path("totalVotes").asInt()),
        () ->
            assertTrue(
                refOf(doc.path("owners"), owner.getId()).isObject(), doc.path("owners").toString()),
        () -> assertTrue(tagFqns(doc).contains(SENSITIVE), doc.path("tags").toString()));
  }

  @Test
  void addDataModel_reindexesTheTable(TestNamespace ns) {
    Table table = table(schema(ns), "modeled", null, List.of());
    awaitDoc(TABLE_INDEX, table.getId(), doc -> true);

    client()
        .tables()
        .updateDataModel(
            table.getId().toString(),
            new DataModel()
                .withModelType(DataModel.ModelType.DBT)
                .withTags(List.of(label(SENSITIVE)))
                .withColumns(
                    List.of(
                        new Column()
                            .withName("id")
                            .withDataType(ColumnDataType.BIGINT)
                            .withTags(List.of(label(PERSONAL))))));

    JsonNode doc = awaitDoc(TABLE_INDEX, table.getId(), d -> tagFqns(d).contains(SENSITIVE));
    assertEquals(Set.of(PERSONAL), tagFqnsOf(doc.path("columns"), "id"));
  }

  @Test
  void deleteStale_softDeleteMarksTheStaleDocumentsDeleted(TestNamespace ns) throws Exception {
    DatabaseSchema schema = schema(ns);
    Table seen = table(schema, "seen", null, List.of());
    Table stale = table(schema, "stale", null, List.of());
    awaitDoc(TABLE_INDEX, stale.getId(), doc -> true);

    deleteStale(schema, seen, false);

    awaitDoc(TABLE_INDEX, stale.getId(), doc -> doc.path("deleted").asBoolean());
    assertFalse(awaitDoc(TABLE_INDEX, seen.getId(), doc -> true).path("deleted").asBoolean());
  }

  @Test
  void deleteStale_hardDeleteRemovesTheStaleDocuments(TestNamespace ns) throws Exception {
    DatabaseSchema schema = schema(ns);
    Table seen = table(schema, "seen", null, List.of());
    Table stale = table(schema, "stale", null, List.of());
    awaitDoc(TABLE_INDEX, stale.getId(), doc -> true);

    deleteStale(schema, seen, true);

    awaitNoDoc(TABLE_INDEX, stale.getId());
    assertFalse(awaitDoc(TABLE_INDEX, seen.getId(), doc -> true).path("deleted").asBoolean());
  }

  @Test
  void renamingTheDatabase_reachesItsTables(final TestNamespace ns) {
    final DatabaseSchema schema = schema(ns);
    final Table table = table(schema, "renamed", null, List.of());
    awaitDoc(TABLE_INDEX, table.getId(), doc -> true);
    final String displayName = renameDatabase(schema, ns.prefix("LAKE_ERP"));

    final Table read = client().tables().get(table.getId().toString());
    read.setDescription("rebuilds the table's search document from the stored table");
    client().tables().update(table.getId().toString(), read);

    assertEquals(displayName, read.getDatabase().getDisplayName());
    final JsonNode doc =
        awaitDoc(
            TABLE_INDEX, table.getId(), d -> d.path("description").asText().startsWith("rebuilds"));
    assertEquals(displayName, doc.path("database").path("displayName").asText(), doc.toString());
  }

  /** Bulk reads are what a Recreate reindex builds documents from; nothing here rewrites a child. */
  @Test
  void renamedParents_reachUntouchedChildrenInBulkReads(final TestNamespace ns) {
    final DatabaseSchema schema = schema(ns);
    table(schema, "untouched", null, List.of());
    final StoredProcedure procedure = storedProcedure(schema);
    final String databaseName = renameDatabase(schema, ns.prefix("LAKE_ERP"));
    final DatabaseSchema renamedSchema = client().databaseSchemas().get(schema.getId().toString());
    renamedSchema.setDisplayName(ns.prefix("STAGING"));
    client().databaseSchemas().update(schema.getId().toString(), renamedSchema);

    final ListParams params = new ListParams();
    params.setDatabaseSchema(schema.getFullyQualifiedName());
    final Table listed = client().tables().list(params).getData().getFirst();
    final StoredProcedure readProcedure =
        client().storedProcedures().get(procedure.getId().toString());

    assertAll(
        () -> assertEquals(databaseName, listed.getDatabase().getDisplayName()),
        () ->
            assertEquals(
                renamedSchema.getDisplayName(), listed.getDatabaseSchema().getDisplayName()),
        () -> assertEquals(databaseName, readProcedure.getDatabase().getDisplayName()));
  }

  private static String renameDatabase(final DatabaseSchema schema, final String displayName) {
    final String databaseId = schema.getDatabase().getId().toString();
    final Database database = client().databases().get(databaseId);
    database.setDisplayName(displayName);
    client().databases().update(databaseId, database);
    return displayName;
  }

  private static StoredProcedure storedProcedure(final DatabaseSchema schema) {
    final CreateStoredProcedure request = new CreateStoredProcedure();
    request.setName("procedure");
    request.setDatabaseSchema(schema.getFullyQualifiedName());
    request.setStoredProcedureCode(
        new StoredProcedureCode()
            .withCode("CREATE PROCEDURE procedure() AS $$ BEGIN RETURN; END; $$ LANGUAGE plpgsql;")
            .withLanguage(StoredProcedureLanguage.SQL));
    return client().storedProcedures().create(request);
  }

  private static void deleteStale(DatabaseSchema schema, Table seen, boolean hardDelete)
      throws Exception {
    BulkApi.deleteStale(
        "tables",
        new BulkDeleteStaleRequest()
            .withScopeFqn(schema.getFullyQualifiedName())
            .withScopeEntityType("databaseSchema")
            .withSeenFqns(List.of(seen.getFullyQualifiedName()))
            .withHardDelete(hardDelete));
  }

  private static boolean inherits(JsonNode doc, Domain domain, User owner) {
    return refOf(doc.path("domains"), domain.getId()).isObject()
        && refOf(doc.path("owners"), owner.getId()).isObject();
  }

  private static DatabaseSchema schema(TestNamespace ns) {
    return DatabaseSchemaTestFactory.createSimple(
        ns, DatabaseServiceTestFactory.createPostgres(ns));
  }

  private static Table table(
      DatabaseSchema schema, String name, List<EntityReference> owners, List<TagLabel> tags) {
    return client()
        .tables()
        .create(
            new CreateTable()
                .withName(name)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withOwners(owners)
                .withTags(tags)
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))));
  }

  private static TagLabel label(String tagFqn) {
    return new TagLabel()
        .withTagFQN(tagFqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }

  private static EntityReference reference(UUID id, String type) {
    return new EntityReference().withId(id).withType(type);
  }

  private static OpenMetadataClient client() {
    return SdkClients.adminClient();
  }
}
