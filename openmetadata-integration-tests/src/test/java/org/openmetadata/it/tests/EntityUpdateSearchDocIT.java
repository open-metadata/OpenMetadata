package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.SearchDocs.awaitDoc;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * A PUT carries only what its sender owns, and a PATCH only what it changes. The entity those
 * updates indexed kept neither the tags a PUT merges in, nor followers and votes, nor what the
 * entity inherits, so search lost them on every such update. Each check waits for a marker of the
 * update, then asserts what survived that same write.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class EntityUpdateSearchDocIT {

  private static final String TABLE_INDEX = "table_search_index";
  private static final String TIER1 = "Tier.Tier1";
  private static final String CHANGED_DESCRIPTION = "changed by a later PUT";

  @Test
  void put_withoutTags_keepsTableAndColumnTagsInSearchDoc(TestNamespace ns) {
    Table table =
        createTable(
            createSchema(ns, false, null),
            List.of(SharedEntities.get().PERSONAL_DATA_TAG_LABEL, classificationLabel(TIER1)),
            List.of(SharedEntities.get().PII_SENSITIVE_TAG_LABEL),
            List.of());
    awaitDoc(TABLE_INDEX, table.getId(), EntityUpdateSearchDocIT::assertTagsAndTier);

    SdkClients.adminClient().tables().createOrUpdate(changedDescriptionPut(table));

    awaitDoc(
        TABLE_INDEX,
        table.getId(),
        doc -> {
          assertEquals(CHANGED_DESCRIPTION, doc.path("description").asText());
          assertTagsAndTier(doc);
        });
  }

  @Test
  void put_keepsFollowersAndVotesInSearchDoc(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTable(createSchema(ns, false, null), List.of(), List.of(), List.of());
    UUID follower = SharedEntities.get().USER1.getId();
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/tables/" + table.getId() + "/vote",
            new VoteRequest().withUpdatedVoteType(VoteRequest.VoteType.VOTED_UP),
            ChangeEvent.class);
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/tables/" + table.getId() + "/followers",
            follower,
            ChangeEvent.class);
    awaitDoc(TABLE_INDEX, table.getId(), doc -> assertFollowerAndVote(doc, follower));

    client.tables().createOrUpdate(changedDescriptionPut(table));

    awaitDoc(
        TABLE_INDEX,
        table.getId(),
        doc -> {
          assertEquals(CHANGED_DESCRIPTION, doc.path("description").asText());
          assertFollowerAndVote(doc, follower);
        });
  }

  @Test
  void put_keepsInheritedDomainInSearchDoc(TestNamespace ns) {
    Table table = createTable(createSchema(ns, true, null), List.of(), List.of(), List.of());
    awaitDoc(TABLE_INDEX, table.getId(), EntityUpdateSearchDocIT::assertSharedDomain);

    SdkClients.adminClient().tables().createOrUpdate(changedDescriptionPut(table));

    awaitDoc(
        TABLE_INDEX,
        table.getId(),
        doc -> {
          assertEquals(CHANGED_DESCRIPTION, doc.path("description").asText());
          assertSharedDomain(doc);
        });
  }

  @Test
  void patch_removingDirectOwner_indexesInheritedOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    EntityReference schemaOwner = SharedEntities.get().USER1_REF;
    EntityReference directOwner = SharedEntities.get().USER2_REF;
    Table table =
        createTable(
            createSchema(ns, false, schemaOwner), List.of(), List.of(), List.of(directOwner));
    awaitDoc(TABLE_INDEX, table.getId(), doc -> assertOwner(doc, directOwner));

    Table withoutOwner = client.tables().get(table.getId().toString(), "owners");
    withoutOwner.setOwners(List.of());
    client.tables().update(table.getId().toString(), withoutOwner);

    awaitDoc(TABLE_INDEX, table.getId(), doc -> assertOwner(doc, schemaOwner));
  }

  /**
   * A schema in its own database. With {@code inDomain} the database carries the shared domain for
   * its tables to inherit; a non-null {@code owner} owns the schema for the same purpose.
   */
  private static DatabaseSchema createSchema(
      TestNamespace ns, boolean inDomain, EntityReference owner) {
    OpenMetadataClient client = SdkClients.adminClient();
    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName(ns.prefix("db"))
            .withService(SharedEntities.get().MYSQL_SERVICE.getFullyQualifiedName());
    if (inDomain) {
      createDatabase.withDomains(List.of(sharedDomainFqn()));
    }
    Database database = client.databases().create(createDatabase);
    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName(ns.prefix("schema"))
            .withDatabase(database.getFullyQualifiedName());
    if (owner != null) {
      createSchema.withOwners(List.of(owner));
    }
    return client.databaseSchemas().create(createSchema);
  }

  private static Table createTable(
      DatabaseSchema schema,
      List<TagLabel> tags,
      List<TagLabel> columnTags,
      List<EntityReference> owners) {
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(schema.getName() + "_table")
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(List.of(idColumn().withTags(columnTags)))
                .withTags(tags)
                .withOwners(owners));
  }

  /** What an ingestion re-run sends: the table's identity and columns, nothing it doesn't own. */
  private static CreateTable changedDescriptionPut(Table table) {
    return new CreateTable()
        .withName(table.getName())
        .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
        .withColumns(List.of(idColumn()))
        .withDescription(CHANGED_DESCRIPTION);
  }

  private static Column idColumn() {
    return new Column().withName("id").withDataType(ColumnDataType.BIGINT);
  }

  private static TagLabel classificationLabel(String tagFqn) {
    return new TagLabel()
        .withTagFQN(tagFqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }

  private static void assertTagsAndTier(JsonNode doc) {
    Set<String> tagFqns = new HashSet<>();
    doc.path("tags").forEach(tag -> tagFqns.add(tag.path("tagFQN").asText()));
    assertAll(
        () ->
            assertTrue(
                tagFqns.contains(SharedEntities.get().PERSONAL_DATA_TAG_LABEL.getTagFQN()),
                "entity tags: " + tagFqns),
        () ->
            assertTrue(
                tagFqns.contains(SharedEntities.get().PII_SENSITIVE_TAG_LABEL.getTagFQN()),
                "column tags merged into the table's: " + tagFqns),
        () -> assertEquals(TIER1, doc.path("tier").path("tagFQN").asText()));
  }

  private static void assertFollowerAndVote(JsonNode doc, UUID follower) {
    assertAll(
        () -> assertEquals(follower.toString(), doc.path("followers").path(0).asText()),
        () -> assertEquals(1, doc.path("totalVotes").asInt()));
  }

  private static void assertOwner(JsonNode doc, EntityReference owner) {
    assertEquals(owner.getId().toString(), doc.path("owners").path(0).path("id").asText());
  }

  private static void assertSharedDomain(JsonNode doc) {
    assertEquals(
        sharedDomainFqn(), doc.path("domains").path(0).path("fullyQualifiedName").asText());
  }

  private static String sharedDomainFqn() {
    return SharedEntities.get().DOMAIN.getFullyQualifiedName();
  }
}
