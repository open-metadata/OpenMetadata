/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.UriTestUtils.encodeURIComponent;

import com.fasterxml.jackson.core.type.TypeReference;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.factories.APIServiceTestFactory;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.factories.DriveServiceTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.MlModelServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.factories.SearchServiceTestFactory;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.AddGlossaryToAssetsRequest;
import org.openmetadata.schema.api.AddTagToAssetsRequest;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.api.data.CreateSpreadsheet;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.data.CreateWorksheet;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.SchemaType;
import org.openmetadata.schema.type.SearchIndexDataType;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Task;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.api.BulkResponse;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * Adding or removing a tag or glossary term from its Assets tab must go through the same versioned
 * update as an edit on the asset's own page: a new version, {@code updatedBy} set to the acting
 * user, and one change event per asset (collate #1526).
 *
 * <p>Assets are created by admin and changed by {@code shared_user1}, so the change cannot be
 * consolidated into the creation version and {@code updatedBy} proves who acted.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AssetsTabTagVersioningIT {

  private static final String ACTING_USER = "shared_user1";
  private static final String ADMIN_USER = "admin";
  private static final String COLUMN = "id";
  private static final String TAGS_FIELD = "tags";
  private static final String COLUMN_TAGS_FIELD = "columns." + COLUMN + ".tags";
  private static final String CERTIFICATION_GOLD = "Certification.Gold";
  private static final Double CREATED_VERSION = 0.1;
  private static final Double FIRST_EDIT_VERSION = 0.2;
  private static final Duration ASYNC_TIMEOUT = Duration.ofSeconds(60);
  private static final Duration QUIET_WINDOW = Duration.ofSeconds(8);

  private record ChildAsset(EntityReference asset, String childFqn) {}

  // ---------------------------------------------------------------------------------------------
  // Tag endpoint (async)
  // ---------------------------------------------------------------------------------------------

  @Test
  void tagAddedToTable_createsVersionAndEventAsActingUser(TestNamespace ns) throws Exception {
    Tag tag = createTag(ns, "add");
    Table table = createTable(ns, createSchema(ns, null), "tbl", null, null);
    long since = System.currentTimeMillis();

    putTagAssets(SdkClients.user1Client(), tag, "add", List.of(table.getEntityReference()), false);

    Table updated = awaitTableVersion(table, FIRST_EDIT_VERSION);
    assertEquals(ACTING_USER, updated.getUpdatedBy());
    assertTrue(hasLabel(updated.getTags(), tag.getFullyQualifiedName()));
    assertChange(versionChange(table).getFieldsAdded(), TAGS_FIELD);
    assertUpdateEvent(Entity.TABLE, table.getId(), since, ACTING_USER, true, TAGS_FIELD);
  }

  @Test
  void tagRemovedFromTable_createsVersionAndEventAsActingUser(TestNamespace ns) throws Exception {
    Tag tag = createTag(ns, "rm");
    Table table = createTable(ns, createSchema(ns, null), "tbl", classificationLabel(tag), null);
    long since = System.currentTimeMillis();

    putTagAssets(
        SdkClients.user1Client(), tag, "remove", List.of(table.getEntityReference()), false);

    Table updated = awaitTableVersion(table, FIRST_EDIT_VERSION);
    assertEquals(ACTING_USER, updated.getUpdatedBy());
    assertFalse(hasLabel(updated.getTags(), tag.getFullyQualifiedName()));
    assertChange(versionChange(table).getFieldsDeleted(), TAGS_FIELD);
    assertUpdateEvent(Entity.TABLE, table.getId(), since, ACTING_USER, false, TAGS_FIELD);
  }

  @Test
  void tagAddedToColumn_versionsTheTable(TestNamespace ns) throws Exception {
    // As admin: the tag endpoint maps no tableColumn to its table for the permission check, so a
    // non-admin gets a 403 on column refs. Admin's first edit after creation is still a new
    // version.
    Tag tag = createTag(ns, "coladd");
    Table table = createTable(ns, createSchema(ns, null), "tbl", null, null);
    long since = System.currentTimeMillis();

    putTagAssets(SdkClients.adminClient(), tag, "add", List.of(columnRef(table)), false);

    Table updated = awaitTableVersion(table, FIRST_EDIT_VERSION);
    assertTrue(hasLabel(column(updated).getTags(), tag.getFullyQualifiedName()));
    assertChange(versionChange(table).getFieldsAdded(), COLUMN_TAGS_FIELD);
    assertUpdateEvent(Entity.TABLE, table.getId(), since, ADMIN_USER, true, COLUMN_TAGS_FIELD);
  }

  @Test
  void tagRemovedFromColumn_versionsTheTable(TestNamespace ns) throws Exception {
    Tag tag = createTag(ns, "colrm");
    Table table = createTable(ns, createSchema(ns, null), "tbl", null, classificationLabel(tag));
    long since = System.currentTimeMillis();

    putTagAssets(SdkClients.adminClient(), tag, "remove", List.of(columnRef(table)), false);

    Table updated = awaitTableVersion(table, FIRST_EDIT_VERSION);
    assertFalse(hasLabel(column(updated).getTags(), tag.getFullyQualifiedName()));
    assertChange(versionChange(table).getFieldsDeleted(), COLUMN_TAGS_FIELD);
    assertUpdateEvent(Entity.TABLE, table.getId(), since, ADMIN_USER, false, COLUMN_TAGS_FIELD);
  }

  @Test
  void removingTableRow_clearsTheLabelFromItsColumn(TestNamespace ns) throws Exception {
    // The table is listed on the Assets tab only because its column carries the tag.
    Tag tag = createTag(ns, "rowcol");
    Table table = createTable(ns, createSchema(ns, null), "tbl", null, classificationLabel(tag));
    long since = System.currentTimeMillis();

    putTagAssets(
        SdkClients.user1Client(), tag, "remove", List.of(table.getEntityReference()), false);

    Table updated = awaitTableVersion(table, FIRST_EDIT_VERSION);
    assertEquals(ACTING_USER, updated.getUpdatedBy());
    assertFalse(hasLabel(column(updated).getTags(), tag.getFullyQualifiedName()));
    assertChange(versionChange(table).getFieldsDeleted(), COLUMN_TAGS_FIELD);
    assertUpdateEvent(Entity.TABLE, table.getId(), since, ACTING_USER, false, COLUMN_TAGS_FIELD);
  }

  @Test
  void removingSchemaRow_leavesTablesInsideItAlone(TestNamespace ns) throws Exception {
    Tag tag = createTag(ns, "schema");
    TagLabel label = classificationLabel(tag);
    DatabaseSchema schema = createSchema(ns, label);
    Table tableA = createTable(ns, schema, "tblA", label, label);
    Table tableB = createTable(ns, schema, "tblB", null, label);
    long since = System.currentTimeMillis();

    putTagAssets(
        SdkClients.user1Client(), tag, "remove", List.of(schema.getEntityReference()), false);

    assertUpdateEvent(
        Entity.DATABASE_SCHEMA, schema.getId(), since, ACTING_USER, false, TAGS_FIELD);
    DatabaseSchema updatedSchema =
        SdkClients.adminClient().databaseSchemas().get(schema.getId().toString(), TAGS_FIELD);
    assertEquals(FIRST_EDIT_VERSION, updatedSchema.getVersion());
    assertEquals(ACTING_USER, updatedSchema.getUpdatedBy());
    assertFalse(hasOwnLabel(updatedSchema.getTags(), tag.getFullyQualifiedName()));

    Table afterA = fetchTable(tableA);
    assertEquals(CREATED_VERSION, afterA.getVersion());
    assertTrue(hasOwnLabel(afterA.getTags(), tag.getFullyQualifiedName()));
    assertTrue(hasLabel(column(afterA).getTags(), tag.getFullyQualifiedName()));
    Table afterB = fetchTable(tableB);
    assertEquals(CREATED_VERSION, afterB.getVersion());
    assertTrue(hasLabel(column(afterB).getTags(), tag.getFullyQualifiedName()));
    assertTrue(updateEvents(Entity.TABLE, tableA.getId(), since).isEmpty());
    assertTrue(updateEvents(Entity.TABLE, tableB.getId(), since).isEmpty());
  }

  @Test
  void tagDryRun_writesNoVersionAndNoEvent(TestNamespace ns) throws Exception {
    Tag tag = createTag(ns, "dry");
    Table table = createTable(ns, createSchema(ns, null), "tbl", null, null);
    long since = System.currentTimeMillis();

    putTagAssets(SdkClients.user1Client(), tag, "add", List.of(table.getEntityReference()), true);

    assertTableStaysUnchanged(table, since, "dry run must not write");
    assertFalse(hasLabel(fetchTable(table).getTags(), tag.getFullyQualifiedName()));
  }

  @Test
  void disabledTag_isNotApplied(TestNamespace ns) throws Exception {
    Tag tag = createTag(ns, "disabled");
    tag.setDisabled(true);
    SdkClients.adminClient().tags().update(tag.getId().toString(), tag);
    Table table = createTable(ns, createSchema(ns, null), "tbl", null, null);
    long since = System.currentTimeMillis();

    putTagAssets(SdkClients.user1Client(), tag, "add", List.of(table.getEntityReference()), false);

    assertTableStaysUnchanged(table, since, "a disabled tag must not be applied");
    assertFalse(hasLabel(fetchTable(table).getTags(), tag.getFullyQualifiedName()));
  }

  @Test
  void certificationTag_isNotAppliedAsATag(TestNamespace ns) throws Exception {
    // Certification lives in its own field; PATCH drops it from a tag diff, so it must be rejected
    // rather than silently certifying the asset or recording a change that was never stored.
    Tag gold = SdkClients.adminClient().tags().getByName(CERTIFICATION_GOLD);
    Table table = createTable(ns, createSchema(ns, null), "tbl", null, null);
    long since = System.currentTimeMillis();

    putTagAssets(SdkClients.user1Client(), gold, "add", List.of(table.getEntityReference()), false);

    assertTableStaysUnchanged(table, since, "a certification tag must not be applied");
    Table after =
        SdkClients.adminClient().tables().get(table.getId().toString(), "tags,certification");
    assertFalse(hasLabel(after.getTags(), CERTIFICATION_GOLD));
    assertNull(after.getCertification());
  }

  static Stream<String> childContainerTypes() {
    return Stream.of(
        Entity.TOPIC,
        Entity.PIPELINE,
        Entity.MLMODEL,
        Entity.CONTAINER,
        Entity.SEARCH_INDEX,
        Entity.API_ENDPOINT,
        Entity.DASHBOARD_DATA_MODEL,
        Entity.WORKSHEET);
  }

  @ParameterizedTest
  @MethodSource("childContainerTypes")
  void removingAssetRow_clearsTheLabelFromItsOwnFields(String entityType, TestNamespace ns)
      throws Exception {
    // A remove only sees the child fields that the PATCH load brings back. If a type's children
    // were missing from that load, the child label would survive and the row would stay listed.
    Tag tag = createTag(ns, "child");
    ChildAsset child = createChildAsset(entityType, ns);
    tagChild(child, classificationLabel(tag));
    assertTrue(childTagFqns(child).contains(tag.getFullyQualifiedName()));
    long since = System.currentTimeMillis();

    putTagAssets(SdkClients.user1Client(), tag, "remove", List.of(child.asset()), false);

    ChangeEvent event = awaitUpdateEvent(entityType, child.asset().getId(), since);
    assertEquals(ACTING_USER, event.getUserName());
    assertFalse(childTagFqns(child).contains(tag.getFullyQualifiedName()));
  }

  // ---------------------------------------------------------------------------------------------
  // Glossary term endpoint (sync)
  // ---------------------------------------------------------------------------------------------

  @Test
  void glossaryTermAddedToTable_createsVersionAndEventAsActingUser(TestNamespace ns)
      throws Exception {
    GlossaryTerm term = createTerm(createGlossary(ns, "add", false), "term");
    Table table = createTable(ns, createSchema(ns, null), "tbl", null, null);
    long since = System.currentTimeMillis();

    BulkOperationResult result =
        putGlossaryAssets(term, "add", List.of(table.getEntityReference()), false);

    assertEquals(ApiStatus.SUCCESS, result.getStatus());
    Table updated = fetchTable(table);
    assertEquals(FIRST_EDIT_VERSION, updated.getVersion());
    assertEquals(ACTING_USER, updated.getUpdatedBy());
    assertTrue(hasLabel(updated.getTags(), term.getFullyQualifiedName()));
    assertChange(versionChange(table).getFieldsAdded(), TAGS_FIELD);
    assertUpdateEvent(Entity.TABLE, table.getId(), since, ACTING_USER, true, TAGS_FIELD);
  }

  @Test
  void glossaryTermRemovedFromTable_createsVersionAndEventAsActingUser(TestNamespace ns)
      throws Exception {
    GlossaryTerm term = createTerm(createGlossary(ns, "rm", false), "term");
    Table table = createTable(ns, createSchema(ns, null), "tbl", glossaryLabel(term), null);
    long since = System.currentTimeMillis();

    BulkOperationResult result =
        putGlossaryAssets(term, "remove", List.of(table.getEntityReference()), false);

    assertEquals(ApiStatus.SUCCESS, result.getStatus());
    Table updated = fetchTable(table);
    assertEquals(FIRST_EDIT_VERSION, updated.getVersion());
    assertEquals(ACTING_USER, updated.getUpdatedBy());
    assertFalse(hasLabel(updated.getTags(), term.getFullyQualifiedName()));
    assertChange(versionChange(table).getFieldsDeleted(), TAGS_FIELD);
    assertUpdateEvent(Entity.TABLE, table.getId(), since, ACTING_USER, false, TAGS_FIELD);
  }

  @Test
  void glossaryTermAddedToColumn_versionsTheTable(TestNamespace ns) throws Exception {
    GlossaryTerm term = createTerm(createGlossary(ns, "coladd", false), "term");
    Table table = createTable(ns, createSchema(ns, null), "tbl", null, null);
    long since = System.currentTimeMillis();

    BulkOperationResult result = putGlossaryAssets(term, "add", List.of(columnRef(table)), false);

    assertEquals(ApiStatus.SUCCESS, result.getStatus());
    Table updated = fetchTable(table);
    assertEquals(FIRST_EDIT_VERSION, updated.getVersion());
    assertEquals(ACTING_USER, updated.getUpdatedBy());
    assertTrue(hasLabel(column(updated).getTags(), term.getFullyQualifiedName()));
    assertChange(versionChange(table).getFieldsAdded(), COLUMN_TAGS_FIELD);
    assertUpdateEvent(Entity.TABLE, table.getId(), since, ACTING_USER, true, COLUMN_TAGS_FIELD);
  }

  @Test
  void glossaryTermRemovedFromColumn_versionsTheTable(TestNamespace ns) throws Exception {
    GlossaryTerm term = createTerm(createGlossary(ns, "colrm", false), "term");
    Table table = createTable(ns, createSchema(ns, null), "tbl", null, glossaryLabel(term));
    long since = System.currentTimeMillis();

    BulkOperationResult result =
        putGlossaryAssets(term, "remove", List.of(columnRef(table)), false);

    assertEquals(ApiStatus.SUCCESS, result.getStatus());
    Table updated = fetchTable(table);
    assertEquals(FIRST_EDIT_VERSION, updated.getVersion());
    assertEquals(ACTING_USER, updated.getUpdatedBy());
    assertFalse(hasLabel(column(updated).getTags(), term.getFullyQualifiedName()));
    assertChange(versionChange(table).getFieldsDeleted(), COLUMN_TAGS_FIELD);
    assertUpdateEvent(Entity.TABLE, table.getId(), since, ACTING_USER, false, COLUMN_TAGS_FIELD);
  }

  @Test
  void glossaryDryRun_predictsTheRealOutcomeAndWritesNothing(TestNamespace ns) throws Exception {
    Glossary glossary = createGlossary(ns, "dry", true);
    GlossaryTerm held = createTerm(glossary, "held");
    GlossaryTerm added = createTerm(glossary, "added");
    DatabaseSchema schema = createSchema(ns, null);
    Table conflicting = createTable(ns, schema, "conflicting", glossaryLabel(held), null);
    Table clean = createTable(ns, schema, "clean", null, null);
    long since = System.currentTimeMillis();

    BulkOperationResult result =
        putGlossaryAssets(
            added,
            "add",
            List.of(conflicting.getEntityReference(), clean.getEntityReference()),
            true);

    assertTrue(result.getDryRun());
    assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus());
    assertEquals(List.of(conflicting.getId()), requestIds(result.getFailedRequest()));
    assertEquals(List.of(clean.getId()), requestIds(result.getSuccessRequest()));
    for (Table table : List.of(conflicting, clean)) {
      Table after = fetchTable(table);
      assertEquals(CREATED_VERSION, after.getVersion());
      assertFalse(hasLabel(after.getTags(), added.getFullyQualifiedName()));
      assertTrue(updateEvents(Entity.TABLE, table.getId(), since).isEmpty());
    }
  }

  @Test
  void oneFailingAsset_doesNotStopTheOthers(TestNamespace ns) throws Exception {
    Glossary glossary = createGlossary(ns, "iso", true);
    GlossaryTerm held = createTerm(glossary, "held");
    GlossaryTerm added = createTerm(glossary, "added");
    DatabaseSchema schema = createSchema(ns, null);
    Table conflicting = createTable(ns, schema, "conflicting", glossaryLabel(held), null);
    Table clean = createTable(ns, schema, "clean", null, null);
    EntityReference orphan = new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE);

    BulkOperationResult result =
        putGlossaryAssets(
            added,
            "add",
            List.of(orphan, conflicting.getEntityReference(), clean.getEntityReference()),
            false);

    assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus());
    assertEquals(3, result.getNumberOfRowsProcessed());
    assertEquals(1, result.getNumberOfRowsPassed());
    assertEquals(2, result.getNumberOfRowsFailed());
    assertEquals(List.of(clean.getId()), requestIds(result.getSuccessRequest()));
    Table cleanAfter = fetchTable(clean);
    assertEquals(FIRST_EDIT_VERSION, cleanAfter.getVersion());
    assertTrue(hasLabel(cleanAfter.getTags(), added.getFullyQualifiedName()));
    Table conflictingAfter = fetchTable(conflicting);
    assertEquals(CREATED_VERSION, conflictingAfter.getVersion());
    assertFalse(hasLabel(conflictingAfter.getTags(), added.getFullyQualifiedName()));
  }

  // ---------------------------------------------------------------------------------------------
  // Fixtures
  // ---------------------------------------------------------------------------------------------

  private static Tag createTag(TestNamespace ns, String name) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Classification classification =
        ns.trackRoot(
            Entity.CLASSIFICATION,
            admin
                .classifications()
                .create(
                    new CreateClassification()
                        .withName(ns.shortPrefix("cls_" + name))
                        .withDescription("Assets tab versioning")));
    return admin
        .tags()
        .create(
            new CreateTag()
                .withName(ns.shortPrefix("tag_" + name))
                .withClassification(classification.getFullyQualifiedName())
                .withDescription("Assets tab versioning"));
  }

  private static Glossary createGlossary(TestNamespace ns, String name, boolean mutuallyExclusive) {
    return ns.trackRoot(
        Entity.GLOSSARY,
        SdkClients.adminClient()
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(ns.shortPrefix("g_" + name))
                    .withDescription("Assets tab versioning")
                    .withMutuallyExclusive(mutuallyExclusive)));
  }

  private static GlossaryTerm createTerm(Glossary glossary, String name) {
    return SdkClients.adminClient()
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(name)
                .withGlossary(glossary.getFullyQualifiedName())
                .withDescription("Assets tab versioning"));
  }

  private static DatabaseSchema createSchema(TestNamespace ns, TagLabel label) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database = DatabaseTestFactory.create(ns, service.getFullyQualifiedName());
    return SdkClients.adminClient()
        .databaseSchemas()
        .create(
            new CreateDatabaseSchema()
                .withName(ns.shortPrefix("schema"))
                .withDatabase(database.getFullyQualifiedName())
                .withTags(labels(label)));
  }

  private static Table createTable(
      TestNamespace ns,
      DatabaseSchema schema,
      String name,
      TagLabel tableLabel,
      TagLabel columnLabel) {
    Column column =
        new Column()
            .withName(COLUMN)
            .withDataType(ColumnDataType.BIGINT)
            .withTags(labels(columnLabel));
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.shortPrefix(name))
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(List.of(column))
                .withTags(labels(tableLabel)));
  }

  private static List<TagLabel> labels(TagLabel label) {
    return label == null ? null : List.of(label);
  }

  private static TagLabel classificationLabel(Tag tag) {
    return label(tag.getFullyQualifiedName(), TagLabel.TagSource.CLASSIFICATION);
  }

  private static TagLabel glossaryLabel(GlossaryTerm term) {
    return label(term.getFullyQualifiedName(), TagLabel.TagSource.GLOSSARY);
  }

  private static TagLabel label(String fqn, TagLabel.TagSource source) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(source)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static EntityReference columnRef(Table table) {
    // The Assets tab sends a tableColumn ref by FQN; the id only satisfies request validation.
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.TABLE_COLUMN)
        .withFullyQualifiedName(table.getFullyQualifiedName() + "." + COLUMN);
  }

  private static ChildAsset createChildAsset(String entityType, TestNamespace ns) {
    return switch (entityType) {
      case Entity.TOPIC -> topicAsset(ns);
      case Entity.PIPELINE -> pipelineAsset(ns);
      case Entity.MLMODEL -> mlModelAsset(ns);
      case Entity.CONTAINER -> containerAsset(ns);
      case Entity.SEARCH_INDEX -> searchIndexAsset(ns);
      case Entity.API_ENDPOINT -> apiEndpointAsset(ns);
      case Entity.DASHBOARD_DATA_MODEL -> dataModelAsset(ns);
      case Entity.WORKSHEET -> worksheetAsset(ns);
      default -> throw new IllegalArgumentException("No fixture for " + entityType);
    };
  }

  private static ChildAsset childAsset(EntityInterface parent, String childPath) {
    return new ChildAsset(
        parent.getEntityReference(), parent.getFullyQualifiedName() + "." + childPath);
  }

  private static ChildAsset topicAsset(TestNamespace ns) {
    String service = MessagingServiceTestFactory.createKafka(ns).getFullyQualifiedName();
    MessageSchema schema =
        new MessageSchema()
            .withSchemaType(SchemaType.JSON)
            .withSchemaFields(
                List.of(new Field().withName("customer").withDataType(FieldDataType.STRING)));
    return childAsset(
        SdkClients.adminClient()
            .topics()
            .create(
                new CreateTopic()
                    .withName(ns.shortPrefix("topic"))
                    .withService(service)
                    .withPartitions(1)
                    .withMessageSchema(schema)),
        "customer");
  }

  private static ChildAsset pipelineAsset(TestNamespace ns) {
    String service = PipelineServiceTestFactory.createAirflow(ns).getFullyQualifiedName();
    return childAsset(
        SdkClients.adminClient()
            .pipelines()
            .create(
                new CreatePipeline()
                    .withName(ns.shortPrefix("pipeline"))
                    .withService(service)
                    .withTasks(List.of(new Task().withName("extract")))),
        "extract");
  }

  private static ChildAsset mlModelAsset(TestNamespace ns) {
    String service = MlModelServiceTestFactory.createMlflow(ns).getFullyQualifiedName();
    return childAsset(
        SdkClients.adminClient()
            .mlModels()
            .create(
                new CreateMlModel()
                    .withName(ns.shortPrefix("model"))
                    .withService(service)
                    .withAlgorithm("xgboost")
                    .withMlFeatures(List.of(new MlFeature().withName("age")))),
        "age");
  }

  private static ChildAsset containerAsset(TestNamespace ns) {
    String service = StorageServiceTestFactory.createS3(ns).getFullyQualifiedName();
    ContainerDataModel dataModel =
        new ContainerDataModel()
            .withColumns(
                List.of(new Column().withName("payload").withDataType(ColumnDataType.STRING)));
    return childAsset(
        SdkClients.adminClient()
            .containers()
            .create(
                new CreateContainer()
                    .withName(ns.shortPrefix("bucket"))
                    .withService(service)
                    .withDataModel(dataModel)),
        "payload");
  }

  private static ChildAsset searchIndexAsset(TestNamespace ns) {
    String service = SearchServiceTestFactory.createElasticSearch(ns).getFullyQualifiedName();
    return childAsset(
        SdkClients.adminClient()
            .searchIndexes()
            .create(
                new CreateSearchIndex()
                    .withName(ns.shortPrefix("index"))
                    .withService(service)
                    .withFields(
                        List.of(
                            new SearchIndexField()
                                .withName("title")
                                .withDataType(SearchIndexDataType.TEXT)))),
        "title");
  }

  private static ChildAsset apiEndpointAsset(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String service = APIServiceTestFactory.createRest(ns).getFullyQualifiedName();
    APICollection collection =
        admin
            .apiCollections()
            .create(
                new CreateAPICollection().withName(ns.shortPrefix("users")).withService(service));
    APISchema schema =
        new APISchema()
            .withSchemaFields(
                List.of(new Field().withName("userId").withDataType(FieldDataType.STRING)));
    return childAsset(
        admin
            .apiEndpoints()
            .create(
                new CreateAPIEndpoint()
                    .withName(ns.shortPrefix("getUser"))
                    .withApiCollection(collection.getFullyQualifiedName())
                    .withEndpointURL(URI.create("https://example.com/users"))
                    .withResponseSchema(schema)),
        "responseSchema.userId");
  }

  private static ChildAsset dataModelAsset(TestNamespace ns) {
    String service = DashboardServiceTestFactory.createMetabase(ns).getFullyQualifiedName();
    return childAsset(
        SdkClients.adminClient()
            .dashboardDataModels()
            .create(
                new CreateDashboardDataModel()
                    .withName(ns.shortPrefix("model"))
                    .withService(service)
                    .withDataModelType(DataModelType.MetabaseDataModel)
                    .withColumns(
                        List.of(new Column().withName("amount").withDataType(ColumnDataType.INT)))),
        "amount");
  }

  private static ChildAsset worksheetAsset(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    String service = DriveServiceTestFactory.createGoogleDrive(ns).getFullyQualifiedName();
    Spreadsheet spreadsheet =
        admin
            .spreadsheets()
            .create(new CreateSpreadsheet().withName(ns.shortPrefix("sheet")).withService(service));
    Worksheet worksheet =
        admin
            .worksheets()
            .create(
                new CreateWorksheet()
                    .withName(ns.shortPrefix("worksheet"))
                    .withSpreadsheet(spreadsheet.getFullyQualifiedName())
                    .withColumns(
                        List.of(
                            new Column().withName("row_id").withDataType(ColumnDataType.STRING))));
    String childFqn =
        admin
            .worksheets()
            .getByName(worksheet.getFullyQualifiedName(), "columns")
            .getColumns()
            .get(0)
            .getFullyQualifiedName();
    return new ChildAsset(worksheet.getEntityReference(), childFqn);
  }

  private static void tagChild(ChildAsset child, TagLabel label) {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            childUrl(child),
            JsonUtils.pojoToJson(Map.of(TAGS_FIELD, List.of(label))));
  }

  private static List<String> childTagFqns(ChildAsset child) {
    String json =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, childUrl(child) + "&fields=tags", null);
    List<String> fqns = new ArrayList<>();
    JsonUtils.readTree(json).path(TAGS_FIELD).forEach(tag -> fqns.add(tag.path("tagFQN").asText()));
    return fqns;
  }

  private static String childUrl(ChildAsset child) {
    return "/v1/columns/name/"
        + encodeURIComponent(child.childFqn())
        + "?entityType="
        + child.asset().getType();
  }

  // ---------------------------------------------------------------------------------------------
  // Calls and checks
  // ---------------------------------------------------------------------------------------------

  private static void putTagAssets(
      OpenMetadataClient client,
      Tag tag,
      String action,
      List<EntityReference> assets,
      boolean dryRun) {
    AddTagToAssetsRequest request =
        new AddTagToAssetsRequest().withAssets(assets).withDryRun(dryRun);
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT, "/v1/tags/" + tag.getId() + "/assets/" + action, request, Void.class);
  }

  private static BulkOperationResult putGlossaryAssets(
      GlossaryTerm term, String action, List<EntityReference> assets, boolean dryRun) {
    AddGlossaryToAssetsRequest request =
        new AddGlossaryToAssetsRequest().withAssets(assets).withDryRun(dryRun);
    return SdkClients.user1Client()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/glossaryTerms/" + term.getId() + "/assets/" + action,
            request,
            BulkOperationResult.class);
  }

  private static Table fetchTable(Table table) {
    return SdkClients.adminClient().tables().get(table.getId().toString(), "columns,tags");
  }

  private static Table awaitTableVersion(Table table, Double version) {
    return Awaitility.await("table " + table.getName() + " reaches version " + version)
        .pollInterval(Duration.ofMillis(500))
        .atMost(ASYNC_TIMEOUT)
        .until(() -> fetchTable(table), fetched -> version.equals(fetched.getVersion()));
  }

  private static ChangeDescription versionChange(Table table) {
    return SdkClients.adminClient()
        .tables()
        .getVersion(table.getId(), FIRST_EDIT_VERSION)
        .getChangeDescription();
  }

  private static void assertTableStaysUnchanged(Table table, long since, String reason) {
    Awaitility.await(reason)
        .pollDelay(Duration.ofSeconds(1))
        .pollInterval(Duration.ofSeconds(1))
        .during(QUIET_WINDOW)
        .atMost(QUIET_WINDOW.plusSeconds(15))
        .until(
            () ->
                CREATED_VERSION.equals(fetchTable(table).getVersion())
                    && updateEvents(Entity.TABLE, table.getId(), since).isEmpty());
  }

  private static Column column(Table table) {
    return table.getColumns().stream()
        .filter(column -> COLUMN.equals(column.getName()))
        .findFirst()
        .orElseThrow();
  }

  private static boolean hasLabel(List<TagLabel> labels, String fqn) {
    return labels != null && labels.stream().anyMatch(label -> fqn.equals(label.getTagFQN()));
  }

  private static boolean hasOwnLabel(List<TagLabel> labels, String fqn) {
    return labels != null
        && labels.stream()
            .anyMatch(
                label ->
                    fqn.equals(label.getTagFQN())
                        && label.getLabelType() != TagLabel.LabelType.DERIVED);
  }

  private static List<UUID> requestIds(List<BulkResponse> responses) {
    List<UUID> ids = new ArrayList<>();
    for (BulkResponse response : responses == null ? List.<BulkResponse>of() : responses) {
      EntityReference ref = JsonUtils.convertValue(response.getRequest(), EntityReference.class);
      ids.add(ref.getId());
    }
    return ids;
  }

  private static void assertChange(List<FieldChange> changes, String fieldName) {
    assertTrue(
        changes.stream().anyMatch(change -> fieldName.equals(change.getName())),
        "expected a change to " + fieldName + " but got " + JsonUtils.pojoToJson(changes));
  }

  private static void assertUpdateEvent(
      String entityType,
      UUID entityId,
      long since,
      String userName,
      boolean added,
      String fieldName) {
    ChangeEvent event = awaitUpdateEvent(entityType, entityId, since);
    assertEquals(userName, event.getUserName());
    ChangeDescription change = event.getChangeDescription();
    assertChange(added ? change.getFieldsAdded() : change.getFieldsDeleted(), fieldName);
  }

  private static ChangeEvent awaitUpdateEvent(String entityType, UUID entityId, long since) {
    List<ChangeEvent> events =
        Awaitility.await("entityUpdated event for " + entityType + " " + entityId)
            .pollInterval(Duration.ofMillis(500))
            .atMost(ASYNC_TIMEOUT)
            .until(() -> updateEvents(entityType, entityId, since), found -> !found.isEmpty());
    assertEquals(1, events.size(), "one change must write one event: " + events);
    return events.get(0);
  }

  private static List<ChangeEvent> updateEvents(String entityType, UUID entityId, long since) {
    List<ChangeEvent> matching = new ArrayList<>();
    String after = null;
    do {
      ListResponse<ChangeEvent> page = eventPage(entityType, since, after);
      for (ChangeEvent event : page.getData() == null ? List.<ChangeEvent>of() : page.getData()) {
        if (entityId.equals(event.getEntityId())
            && event.getEventType() == EventType.ENTITY_UPDATED) {
          matching.add(event);
        }
      }
      after = page.getPaging() == null ? null : page.getPaging().getAfter();
    } while (after != null);
    return matching;
  }

  private static ListResponse<ChangeEvent> eventPage(String entityType, long since, String after) {
    Map<String, String> params = new HashMap<>();
    params.put("entityUpdated", entityType);
    params.put("timestamp", Long.toString(since));
    params.put("limit", "1000");
    if (after != null) {
      params.put("after", after);
    }
    String json =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/events",
                null,
                RequestOptions.builder().queryParams(params).build());
    return JsonUtils.readValue(json, new TypeReference<ListResponse<ChangeEvent>>() {});
  }
}
