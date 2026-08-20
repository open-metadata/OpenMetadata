package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;

/**
 * Regression tests for optimistic-concurrency (If-Match / ETag) PATCH on tables.
 *
 * <p>Guards the bug where the optimistic-locking PATCH path resolved the base {@code EntityUpdater}
 * instead of the entity-specific updater (e.g. {@code TableUpdater}), so nested column changes —
 * tags and descriptions — were silently dropped: the server returned 200 with the change echoed in
 * the response body, but it never persisted. Top-level fields were unaffected, which is why the bug
 * hid. These tests fail without the {@code getUpdater} delegation fix in {@code EntityRepository}.
 *
 * <p>{@code If-Match: *} deterministically forces the optimistic-locking path (the header is present
 * and non-empty, and {@code *} matches any current ETag), without the test needing to read or
 * recompute the entity's ETag.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class OptimisticLockingColumnPatchIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String MATCH_ANY = "*";

  @Test
  void patchWithIfMatch_columnTag_persists(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Tag tag = createTag(client, ns, "OptLockTagCls", "OptLockTag");
    Table table = createTwoColumnTable(client, ns, "optlock_col_tag");

    JsonNode patch =
        OBJECT_MAPPER.readTree(
            "[{\"op\":\"add\",\"path\":\"/columns/0/tags\",\"value\":[{\"tagFQN\":\""
                + tag.getFullyQualifiedName()
                + "\",\"source\":\"Classification\",\"labelType\":\"Manual\",\"state\":\"Confirmed\"}]}]");

    client.tables().patch(table.getId(), patch, MATCH_ANY);

    Table fetched = client.tables().get(table.getId().toString(), "columns,tags");
    List<TagLabel> columnTags = fetched.getColumns().get(0).getTags();
    assertNotNull(columnTags, "Column tag must persist on the optimistic-locking (If-Match) path");
    assertFalse(columnTags.isEmpty(), "Column tag must persist on the If-Match path");
    assertEquals(tag.getFullyQualifiedName(), columnTags.get(0).getTagFQN());
  }

  @Test
  void patchWithIfMatch_columnDescription_persists(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTwoColumnTable(client, ns, "optlock_col_desc");

    JsonNode patch =
        OBJECT_MAPPER.readTree(
            "[{\"op\":\"add\",\"path\":\"/columns/0/description\",\"value\":\"opt lock column desc\"}]");

    client.tables().patch(table.getId(), patch, MATCH_ANY);

    Table fetched = client.tables().get(table.getId().toString(), "columns,tags");
    assertEquals("opt lock column desc", fetched.getColumns().get(0).getDescription());
  }

  @Test
  void patchWithStaleIfMatch_isRejected(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Table table = createTwoColumnTable(client, ns, "optlock_stale");

    JsonNode patch =
        readTree("[{\"op\":\"add\",\"path\":\"/columns/0/description\",\"value\":\"x\"}]");

    // A non-matching ETag must be rejected (HTTP 412), not silently applied last-write-wins.
    assertThrows(
        Exception.class,
        () -> client.tables().patch(table.getId(), patch, "\"stale-etag\""),
        "A stale If-Match ETag must be rejected with a precondition failure");
  }

  private Table createTwoColumnTable(OpenMetadataClient client, TestNamespace ns, String name) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    CreateTable createTable = new CreateTable();
    createTable.setName(ns.prefix(name));
    createTable.setDatabaseSchema(schema.getFullyQualifiedName());
    createTable.setColumns(
        List.of(
            ColumnBuilder.of("id", "BIGINT").build(), ColumnBuilder.of("amount", "INT").build()));
    return client.tables().create(createTable);
  }

  private Tag createTag(
      OpenMetadataClient client, TestNamespace ns, String classificationName, String tagName) {
    Classification classification =
        client
            .classifications()
            .create(
                new CreateClassification()
                    .withName(ns.prefix(classificationName))
                    .withDescription("optimistic-locking column patch test"));
    return client
        .tags()
        .create(
            new CreateTag()
                .withName(tagName)
                .withDescription("optimistic-locking column patch tag")
                .withClassification(classification.getFullyQualifiedName()));
  }

  private JsonNode readTree(String json) {
    JsonNode node;
    try {
      node = OBJECT_MAPPER.readTree(json);
    } catch (Exception e) {
      throw new IllegalStateException("Invalid test JSON patch", e);
    }
    return node;
  }
}
