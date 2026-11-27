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

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.URLEncoder;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.APIServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DriveServiceTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.DenyPolicyPrincipals;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.AddGlossaryToAssetsRequest;
import org.openmetadata.schema.api.data.BulkColumnUpdatePreview;
import org.openmetadata.schema.api.data.BulkColumnUpdateRequest;
import org.openmetadata.schema.api.data.ColumnUpdate;
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreateFile;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateMetric;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.schema.api.tests.CreateTestCase;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.type.APIRequestMethod;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.BulkCreateItemResult;
import org.openmetadata.schema.type.BulkCreateResult;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.DataModel;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Only an Approved glossary term shows on an asset, whichever API applies it: the UI only offers
 * Approved terms, and the API holds the same line. A write that applies a term that is not Approved
 * succeeds, but the term is held back as a pending label that no read shows, until the term is
 * approved. A term already on an asset stays there when it later leaves Approved, so writes that
 * carry it unchanged keep it.
 *
 * <p>Glossaries are created under {@link GlossaryTestFactory#STATUS_TEST_GLOSSARY_PREFIX}, which the
 * suite excludes from the approval workflow, so each term keeps the stage the test gives it.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class GlossaryTermApprovedTaggingIT {

  @Test
  void createTableWithDeprecatedTerm_holdsIt(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);

    CreateTable request = tableRequest(ns, schema(ns), "create_dep");
    request.setTags(List.of(label(term)));

    Table created = client.tables().create(request);
    assertHeld(term, 1, created, reread(client, created));
  }

  @Test
  void createTableWithDraftTermOnColumn_holdsIt(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = draftTerm(client, ns);
    assertEquals(EntityStatus.DRAFT, term.getEntityStatus());

    CreateTable request = tableRequest(ns, schema(ns), "create_draft_col");
    request.getColumns().get(0).setTags(List.of(label(term)));

    Table created = client.tables().create(request);
    assertHeld(term, 1, created, reread(client, created));
  }

  @Test
  void putTableAddingDeprecatedTerm_holdsIt(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    CreateTable request = tableRequest(ns, schema(ns), "put_dep");
    client.tables().create(request);

    request.setTags(List.of(label(term)));

    Table put = client.tables().createOrUpdate(request);
    assertHeld(term, 1, put, reread(client, put));
  }

  @Test
  void patchTableAddingDeprecatedTerm_holdsIt(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    Table table = client.tables().create(tableRequest(ns, schema(ns), "patch_dep"));

    Table fetched = client.tables().get(table.getId().toString(), "tags,columns");
    fetched.setTags(List.of(label(term)));

    Table patched = client.tables().update(table.getId().toString(), fetched);
    assertHeld(term, 1, patched, reread(client, table));
  }

  @Test
  void patchColumnAddingDraftTerm_holdsIt(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = draftTerm(client, ns);
    Table table = client.tables().create(tableRequest(ns, schema(ns), "patch_draft_col"));

    Table fetched = client.tables().get(table.getId().toString(), "tags,columns");
    fetched.getColumns().get(0).setTags(List.of(label(term)));

    Table patched = client.tables().update(table.getId().toString(), fetched);
    assertHeld(term, 1, patched, reread(client, table));
  }

  @Test
  void bulkAddDeprecatedTermToAssets_holdsIt(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    Table table = client.tables().create(tableRequest(ns, schema(ns), "bulk_add_dep"));

    AddGlossaryToAssetsRequest request =
        new AddGlossaryToAssetsRequest()
            .withDryRun(false)
            .withAssets(List.of(table.getEntityReference()));
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/glossaryTerms/%s/assets/add".formatted(term.getId()),
            request,
            BulkOperationResult.class);

    assertHeld(term, 1, reread(client, table));
  }

  @Test
  void bulkPutOfTablesWithDeprecatedTerm_createsBothAndHoldsTheTerm(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    DatabaseSchema schema = schema(ns);
    CreateTable tagged = tableRequest(ns, schema, "bulk_put_dep");
    tagged.setTags(List.of(label(term)));
    CreateTable plain = tableRequest(ns, schema, "bulk_put_plain");

    BulkOperationResult result = client.tables().bulkCreateOrUpdate(List.of(tagged, plain));

    assertEquals(ApiStatus.SUCCESS, result.getStatus(), () -> String.valueOf(result));
    Table created =
        client
            .tables()
            .getByName(
                "%s.%s".formatted(schema.getFullyQualifiedName(), tagged.getName()),
                "tags,columns");
    assertHeld(term, 1, created);
  }

  @Test
  void dataModelBringingDeprecatedTermToColumn_holdsIt(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    Table table = client.tables().create(tableRequest(ns, schema(ns), "data_model_dep"));

    DataModel dataModel =
        new DataModel()
            .withModelType(DataModel.ModelType.DBT)
            .withColumns(
                List.of(
                    new Column()
                        .withName("id")
                        .withDataType(ColumnDataType.BIGINT)
                        .withTags(List.of(label(term)))));

    Table updated = client.tables().updateDataModel(table.getId(), dataModel);
    assertHeld(
        term, 1, updated, client.tables().get(table.getId().toString(), "tags,columns,dataModel"));
  }

  /** Holding a term on one column does not let it show on another. */
  @Test
  void termHeldOnOneColumn_isHeldBackOnAnother(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = approvedTerm(client, ns);
    CreateTable request = tableRequest(ns, schema(ns), "other_column");
    request.getColumns().add(new Column().withName("total").withDataType(ColumnDataType.INT));
    request.getColumns().get(0).setTags(List.of(label(term)));
    Table table = client.tables().create(request);
    deprecate(client, term);

    Table fetched = client.tables().get(table.getId().toString(), "tags,columns");
    fetched.getColumns().get(1).setTags(List.of(label(term)));
    fetched.setTags(List.of(label(term)));
    client.tables().update(table.getId().toString(), fetched);

    Table after = reread(client, table);
    assertTrue(hasTerm(after.getColumns().get(0).getTags(), term));
    assertFalse(hasTerm(after.getColumns().get(1).getTags(), term));
    assertFalse(hasTerm(after.getTags(), term));
    assertEquals(2, pendingTargets(term).size());
  }

  @Test
  void columnApiAddingDeprecatedTerm_holdsIt(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    Table table = client.tables().create(tableRequest(ns, schema(ns), "column_api_dep"));
    String columnFqn = table.getColumns().get(0).getFullyQualifiedName();

    Column updated =
        client.tables().updateColumn(columnFqn, new UpdateColumn().withTags(List.of(label(term))));

    assertHeld(term, 1, updated, reread(client, table));
  }

  /** A preview writes nothing, so it holds nothing back either. */
  @Test
  void columnBulkUpdatePreviewWithDeprecatedTerm_storesNothing(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    Table table = client.tables().create(tableRequest(ns, schema(ns), "column_preview_dep"));
    BulkColumnUpdateRequest request =
        new BulkColumnUpdateRequest()
            .withColumnUpdates(
                List.of(
                    new ColumnUpdate()
                        .withColumnFQN(table.getColumns().get(0).getFullyQualifiedName())
                        .withEntityType(Entity.TABLE)
                        .withTags(List.of(label(term)))));

    client
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/columns/bulk-update-preview",
            request,
            BulkColumnUpdatePreview.class);

    assertTrue(pendingTargets(term).isEmpty());
    assertFalse(hasTerm(reread(client, table).getColumns().get(0).getTags(), term));
  }

  @Test
  void createManyWithDeprecatedTerm_createsEveryInputAndHoldsTheTerm(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    Table table = client.tables().create(tableRequest(ns, shortSchema(ns), "create_many_dep"));
    CreateTestCase valid = rowCountTestCase(table, ns.shortPrefix("valid_case"));
    CreateTestCase tagged =
        rowCountTestCase(table, ns.shortPrefix("tagged_case")).withTags(List.of(label(term)));

    BulkCreateResult result =
        client
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                "/v1/dataQuality/testCases/createMany",
                List.of(valid, tagged),
                BulkCreateResult.class,
                RequestOptions.builder().queryParam("onConflict", "skip").build());

    assertEquals(2, result.getCreatedCount(), () -> String.valueOf(result));
    BulkCreateItemResult created = result.getResults().get(1);
    assertHeld(term, 1, client.testCases().get(created.getId().toString(), "tags"));
  }

  /**
   * Moving a container rewrites its data-model column FQNs before their stored labels are re-keyed,
   * so a term a column already holds must still count as held after it leaves Approved.
   */
  @Test
  void movingContainerKeepsColumnTermThatLeftApproved(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = approvedTerm(client, ns);
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container parentA = client.containers().create(containerRequest(ns, "parent_a", service));
    Container parentB = client.containers().create(containerRequest(ns, "parent_b", service));
    Container child =
        client
            .containers()
            .create(
                withTaggedColumn(
                    containerRequest(ns, "child", service).withParent(parentA.getEntityReference()),
                    term));
    deprecate(client, term);

    Container loaded = client.containers().get(child.getId().toString(), "dataModel,parent,tags");
    loaded.setParent(parentB.getEntityReference());
    Container moved = client.containers().update(child.getId().toString(), loaded);

    Container refetched =
        client.containers().get(moved.getId().toString(), "dataModel,parent,tags");
    assertEquals(parentB.getId(), refetched.getParent().getId());
    assertTrue(hasTerm(refetched.getDataModel().getColumns().get(0).getTags(), term));
  }

  /**
   * A column whose dataType changes is dropped and re-added under the same FQN; the term held on it
   * stays held there.
   */
  @Test
  void aColumnReaddedWithANewDataTypeKeepsItsHeldTerm(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    CreateTable request = tableRequest(ns, schema(ns), "retyped_column");
    request.getColumns().get(0).setTags(List.of(label(term)));
    Table table = client.tables().create(request);
    String columnHash =
        FullyQualifiedName.buildHash(table.getColumns().get(0).getFullyQualifiedName());
    assertEquals(List.of(columnHash), pendingTargets(term));

    request.getColumns().get(0).withDataType(ColumnDataType.INT).setTags(List.of());
    client.tables().createOrUpdate(request);

    assertEquals(List.of(columnHash), pendingTargets(term));
  }

  /** A container moved to another parent takes the term held on it to its new FQN. */
  @Test
  void movingAContainerMovesItsHeldTerm(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container parentA = client.containers().create(containerRequest(ns, "held_a", service));
    Container parentB = client.containers().create(containerRequest(ns, "held_b", service));
    Container child =
        client
            .containers()
            .create(
                containerRequest(ns, "held_child", service)
                    .withParent(parentA.getEntityReference())
                    .withTags(List.of(label(term))));
    assertEquals(1, pendingTargets(term).size());

    Container loaded = client.containers().get(child.getId().toString(), "parent,tags");
    loaded.setParent(parentB.getEntityReference());
    Container moved = client.containers().update(child.getId().toString(), loaded);

    assertEquals(
        List.of(FullyQualifiedName.buildHash(moved.getFullyQualifiedName())), pendingTargets(term));
  }

  private static CreateContainer containerRequest(
      TestNamespace ns, String suffix, StorageService service) {
    return new CreateContainer()
        .withName(ns.shortPrefix(suffix))
        .withService(service.getFullyQualifiedName());
  }

  private static CreateContainer withTaggedColumn(CreateContainer request, GlossaryTerm term) {
    return request.withDataModel(
        new ContainerDataModel()
            .withIsPartitioned(false)
            .withColumns(
                List.of(
                    new Column()
                        .withName("amount")
                        .withDataType(ColumnDataType.INT)
                        .withTags(List.of(label(term))))));
  }

  private static CreateTestCase rowCountTestCase(Table table, String name) {
    return new CreateTestCase()
        .withName(name)
        .withEntityLink("<#E::table::%s>".formatted(table.getFullyQualifiedName()))
        .withTestDefinition("tableRowCountToEqual")
        .withParameterValues(
            List.of(new TestCaseParameterValue().withName("value").withValue("100")));
  }

  /** File columns are not in the shared field registry, yet their tags are stored. */
  @Test
  void fileColumnWithDeprecatedTerm_holdsIt(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    DriveService drive = DriveServiceTestFactory.createGoogleDrive(ns);
    CreateFile request =
        new CreateFile()
            .withName(ns.shortPrefix("file_dep"))
            .withService(drive.getFullyQualifiedName())
            .withColumns(
                List.of(
                    new Column()
                        .withName("amount")
                        .withDataType(ColumnDataType.INT)
                        .withTags(List.of(label(term)))));

    org.openmetadata.schema.entity.data.File created = client.files().create(request);
    assertHeld(term, 1, created, client.files().get(created.getId().toString(), "columns,tags"));
  }

  /** A request field shares its name with a response field; each is judged on its own. */
  @Test
  void apiRequestFieldWithDeprecatedTerm_holdsItThereOnly(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = approvedTerm(client, ns);
    ApiService service = APIServiceTestFactory.createRest(ns);
    APICollection collection =
        client
            .apiCollections()
            .create(
                new CreateAPICollection()
                    .withName(ns.shortPrefix("collection"))
                    .withService(service.getFullyQualifiedName())
                    .withEndpointURL(URI.create("https://localhost:8585/api/v1")));
    APIEndpoint endpoint =
        client
            .apiEndpoints()
            .create(
                new CreateAPIEndpoint()
                    .withName(ns.shortPrefix("endpoint"))
                    .withApiCollection(collection.getFullyQualifiedName())
                    .withEndpointURL(URI.create("https://localhost:8585/api/v1/orders"))
                    .withRequestMethod(APIRequestMethod.POST)
                    .withRequestSchema(schemaWithField())
                    .withResponseSchema(schemaWithField(label(term))));
    deprecate(client, term);

    APIEndpoint fetched =
        client.apiEndpoints().get(endpoint.getId().toString(), "requestSchema,responseSchema,tags");
    fetched.getRequestSchema().getSchemaFields().get(0).setTags(List.of(label(term)));

    client.apiEndpoints().update(endpoint.getId().toString(), fetched);

    APIEndpoint after =
        client.apiEndpoints().get(endpoint.getId().toString(), "requestSchema,responseSchema,tags");
    assertFalse(hasTerm(after.getRequestSchema().getSchemaFields().get(0).getTags(), term));
    assertTrue(hasTerm(after.getResponseSchema().getSchemaFields().get(0).getTags(), term));
    assertEquals(1, pendingTargets(term).size());
  }

  /** A daily dbt run re-sends the terms its model already applied; that keeps working. */
  @Test
  void dataModelResendingHeldTermThatLeftApproved_succeeds(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = approvedTerm(client, ns);
    Table table = client.tables().create(tableRequest(ns, schema(ns), "data_model_resend"));
    DataModel dataModel =
        new DataModel()
            .withModelType(DataModel.ModelType.DBT)
            .withColumns(
                List.of(
                    new Column()
                        .withName("id")
                        .withDataType(ColumnDataType.BIGINT)
                        .withTags(List.of(label(term)))));
    client.tables().updateDataModel(table.getId(), dataModel);
    deprecate(client, term);

    Table resent = client.tables().updateDataModel(table.getId(), dataModel);

    assertTrue(hasTerm(resent.getColumns().get(0).getTags(), term));
  }

  private static APISchema schemaWithField(TagLabel... tags) {
    return new APISchema()
        .withSchemaFields(
            List.of(
                new Field()
                    .withName("id")
                    .withDataType(FieldDataType.STRING)
                    .withTags(List.of(tags))));
  }

  /** A bulk PUT that updates an existing table holds the term it adds the same way. */
  @Test
  void bulkPutAddingDeprecatedTermToExistingTable_holdsIt(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    CreateTable request = tableRequest(ns, schema(ns), "bulk_update_dep");
    Table table = client.tables().create(request);
    request.setTags(List.of(label(term)));

    BulkOperationResult result = client.tables().bulkCreateOrUpdate(List.of(request));

    assertEquals(ApiStatus.SUCCESS, result.getStatus(), () -> String.valueOf(result));
    assertHeld(term, 1, reread(client, table));
  }

  /**
   * The rule is about applying a term, not about holding one: a term that leaves Approved after it
   * was applied stays on the asset, and edits and re-sends that carry it unchanged still succeed.
   */
  @Test
  void termThatLeavesApprovedAfterTagging_staysAndDoesNotBlockLaterWrites(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = approvedTerm(client, ns);
    CreateTable request = tableRequest(ns, schema(ns), "existing_tag");
    request.setTags(List.of(label(term)));
    request.getColumns().get(0).setTags(List.of(label(term)));
    Table table = client.tables().create(request);

    deprecate(client, term);

    Table fetched = client.tables().get(table.getId().toString(), "tags,columns");
    fetched.setDescription("edited after the term was deprecated");
    Table patched = client.tables().update(table.getId().toString(), fetched);
    assertTrue(hasTerm(patched.getTags(), term));

    Table put = client.tables().createOrUpdate(request.withDescription("re-sent by ingestion"));
    assertTrue(hasTerm(put.getTags(), term));
    assertTrue(hasTerm(put.getColumns().get(0).getTags(), term));

    BulkOperationResult bulk =
        client.tables().bulkCreateOrUpdate(List.of(request.withDescription("re-sent in bulk")));
    assertEquals(
        ApiStatus.SUCCESS, bulk.getStatus(), () -> String.valueOf(bulk.getFailedRequest()));
  }

  @Test
  void approvedTerm_canStillBeApplied(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = approvedTerm(client, ns);
    Table table = client.tables().create(tableRequest(ns, schema(ns), "approved"));

    Table fetched = client.tables().get(table.getId().toString(), "tags,columns");
    fetched.setTags(List.of(label(term)));
    fetched.getColumns().get(0).setTags(List.of(label(term)));
    Table patched = client.tables().update(table.getId().toString(), fetched);

    assertTrue(hasTerm(patched.getTags(), term));
    assertTrue(hasTerm(patched.getColumns().get(0).getTags(), term));
  }

  /** Approving the term shows it on every target it was held back from, with no new write. */
  @Test
  void approvingTheTermShowsItWhereItWasHeld(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = draftTerm(client, ns);
    CreateTable request = tableRequest(ns, schema(ns), "approve_shows");
    request.setTags(List.of(label(term)));
    request.getColumns().get(0).setTags(List.of(label(term)));
    Table table = client.tables().create(request);
    assertHeld(term, 2, reread(client, table));
    Double versionBefore = reread(client, table).getVersion();
    long approvedAt = System.currentTimeMillis();

    setStatus(client, term, EntityStatus.APPROVED);

    Awaitility.await("held term shown once approved")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              Table shown = reread(client, table);
              return hasTerm(shown.getTags(), term)
                  && hasTerm(shown.getColumns().get(0).getTags(), term);
            });
    assertTrue(pendingTargets(term).isEmpty());
    assertTrue(
        reread(client, table).getVersion() > versionBefore,
        "approval is an ordinary edit of the asset, so it records a version");
    Awaitility.await("approval records a change event for the asset")
        .atMost(Duration.ofSeconds(30))
        .pollInterval(Duration.ofSeconds(1))
        .until(() -> updateEventsSince(client, approvedAt).contains(table.getId().toString()));
  }

  // Other tests update tables concurrently and events come oldest first, so every page is read.
  private static List<String> updateEventsSince(OpenMetadataClient client, long timestamp) {
    List<String> entityIds = new ArrayList<>();
    String after = null;
    do {
      String query = "/v1/events?entityUpdated=%s&timestamp=%d".formatted(Entity.TABLE, timestamp);
      JsonNode events =
          client
              .getHttpClient()
              .execute(
                  HttpMethod.GET,
                  after == null
                      ? query
                      : "%s&after=%s".formatted(query, URLEncoder.encode(after, UTF_8)),
                  null,
                  JsonNode.class);
      events.get("data").forEach(event -> entityIds.add(event.get("entityId").asText()));
      JsonNode next = events.path("paging").path("after");
      after = next.isMissingNode() || next.isNull() ? null : next.asText();
    } while (after != null);
    return entityIds;
  }

  /**
   * The classification a held term carries would otherwise reach the asset as a derived tag ahead
   * of the term itself: it is held with the term and shown with it once the term is approved.
   */
  @Test
  void theClassificationAHeldTermCarriesIsHeldWithIt(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    TagLabel carried = SharedEntities.get().PII_SENSITIVE_TAG_LABEL;
    GlossaryTerm term = draftTerm(client, ns, carried);
    CreateTable request = tableRequest(ns, schema(ns), "carried_tag");
    request.setTags(List.of(label(term)));
    Table table = client.tables().create(request);

    assertFalse(hasTag(table.getTags(), carried.getTagFQN()), () -> table.getTags().toString());
    assertHeld(term, 1, reread(client, table));
    assertFalse(hasTag(reread(client, table).getTags(), carried.getTagFQN()));

    setStatus(client, term, EntityStatus.APPROVED);

    Awaitility.await("held term and its classification shown once approved")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () -> {
              List<TagLabel> shown = reread(client, table).getTags();
              return hasTerm(shown, term) && hasTag(shown, carried.getTagFQN());
            });
  }

  /**
   * One user's edits within a session are consolidated into one version, so a term deprecated and
   * approved again by the same user looks unchanged against the version before the session. Its
   * approval still shows what was held while it was deprecated.
   */
  @Test
  void approvingAgainInTheSameSessionShowsWhatWasHeldMeanwhile(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    CreateTable request = tableRequest(ns, schema(ns), "same_session");
    request.setTags(List.of(label(term)));
    Table table = client.tables().create(request);
    assertHeld(term, 1, reread(client, table));

    setStatus(client, term, EntityStatus.APPROVED);

    Awaitility.await("held term shown once approved again in the same session")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(1))
        .until(() -> hasTerm(reread(client, table).getTags(), term));
    assertTrue(pendingTargets(term).isEmpty());
  }

  /**
   * A target that refuses the approved term, here a column showing a term of the same mutually
   * exclusive glossary, keeps it pending without keeping it from the asset's other targets.
   */
  @Test
  void aConflictOnOneTargetKeepsOnlyThatTargetPending(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    Glossary glossary =
        ns.trackRoot(
            Entity.GLOSSARY,
            client
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(ns.prefix(GlossaryTestFactory.STATUS_TEST_GLOSSARY_PREFIX))
                        .withDescription("Mutually exclusive glossary")
                        .withMutuallyExclusive(true)
                        .withReviewers(
                            List.of(client.users().getByName("admin").getEntityReference()))));
    GlossaryTerm shown =
        setStatus(
            client, createTerm(client, glossary, ns.shortPrefix("shown")), EntityStatus.APPROVED);
    GlossaryTerm held = createTerm(client, glossary, ns.shortPrefix("held"));
    CreateTable request = tableRequest(ns, schema(ns), "exclusive_held");
    request.setTags(List.of(label(held)));
    request.getColumns().get(0).setTags(List.of(label(held)));
    Table table = client.tables().create(request);
    assertEquals(2, pendingTargets(held).size());
    // The column is given the other term while the held one waits: nothing it shows conflicts yet.
    Table tagged = reread(client, table);
    tagged.getColumns().get(0).setTags(List.of(label(shown)));
    client.tables().update(table.getId().toString(), tagged);

    setStatus(client, held, EntityStatus.APPROVED);

    Awaitility.await("the table shows the term")
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(1))
        .until(() -> hasTerm(reread(client, table).getTags(), held));
    assertFalse(hasTerm(reread(client, table).getColumns().get(0).getTags(), held));
    assertEquals(1, pendingTargets(held).size(), "the conflicting column keeps it pending");
  }

  @Test
  void rejectingTheTermDropsWhatItHeld(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = draftTerm(client, ns);
    CreateTable request = tableRequest(ns, schema(ns), "reject_drops");
    request.setTags(List.of(label(term)));
    Table table = client.tables().create(request);
    assertHeld(term, 1, reread(client, table));

    setStatus(client, term, EntityStatus.REJECTED);

    assertTrue(pendingTargets(term).isEmpty());
    assertFalse(hasTerm(reread(client, table).getTags(), term));
  }

  /**
   * A held term is not part of what a client sees, so a client cannot remove it, and a write that
   * replaces the asset's tags keeps it; a repeated sync holds it once.
   */
  @Test
  void writesThatReplaceTagsKeepTheHeldTerm(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    CreateTable request = tableRequest(ns, schema(ns), "keeps_held");
    request.setTags(List.of(label(term)));
    Table table = client.tables().create(request);
    client.tables().createOrUpdate(request);

    Table fetched = reread(client, table);
    fetched.setTags(List.of());
    fetched.setDescription("tags cleared by a client");
    client.tables().update(table.getId().toString(), fetched);
    client.tables().createOrUpdate(request.withTags(List.of()));

    assertEquals(1, pendingTargets(term).size());
  }

  /**
   * CSV export leaves a held term out, and re-importing that export, which rewrites the table's
   * tags, keeps the term held.
   */
  @Test
  void csvExportAndReimportKeepTheHeldTerm(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    CreateTable request = tableRequest(ns, schema(ns), "csv_held");
    request.setTags(List.of(label(term)));
    request.getColumns().get(0).setTags(List.of(label(term)));
    Table table = client.tables().create(request);
    assertHeld(term, 2, reread(client, table));

    String exported = client.tables().exportCsv(table.getFullyQualifiedName());
    assertFalse(exported.contains(term.getFullyQualifiedName()), exported);
    client.tables().importCsv(table.getFullyQualifiedName(), exported, false);

    assertHeld(term, 2, reread(client, table));
  }

  /** The term lists the assets it is pending on, so a reviewer sees what approval will tag. */
  @Test
  void pendingAssetsListsTheAssetsATermIsHeldOn(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    CreateTable request = tableRequest(ns, schema(ns), "pending_assets");
    request.getColumns().get(0).setTags(List.of(label(term)));
    Table table = client.tables().create(request);

    // Only the table: the schema and database above it are taggable but do not hold the term.
    assertEquals(List.of(table.getId().toString()), pendingAssetIds(client, term));
    assertFalse(
        reread(client, table).getColumns().get(0).getTags().stream()
            .anyMatch(tag -> term.getFullyQualifiedName().equals(tag.getTagFQN())));
  }

  /**
   * An entity whose FQN runs into a held column's, here a metric named after it, does not hide the
   * table that holds the column from the term's pending assets.
   */
  @Test
  void pendingAssetsKeepsATableWhoseColumnFqnAnotherEntityShares(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    // The metric's name is the column's FQN, so the FQN has to fit a name.
    CreateTable request = tableRequest(ns, shortSchema(ns), "pending_collision");
    request.setName("t_%s".formatted(ns.uniqueShortId()));
    request.getColumns().get(0).setTags(List.of(label(term)));
    Table table = client.tables().create(request);
    client
        .metrics()
        .create(
            new CreateMetric()
                .withName(table.getColumns().get(0).getFullyQualifiedName())
                .withDescription("Metric named like a held column"));

    assertTrue(pendingAssetIds(client, term).contains(table.getId().toString()));
  }

  /**
   * A pending term is not shown, so a write that sends the asset's labels without it, by anyone,
   * keeps it. Removing the term from the asset through the term's assets/remove takes it back, on
   * the asset and on its columns.
   */
  @Test
  void onlyRemovingTheTermFromTheAssetDropsTheHeldTerm(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(admin, ns);
    CreateTable request = tableRequest(ns, schema(ns), "remove_held");
    request.setTags(List.of(label(term)));
    request.getColumns().get(0).setTags(List.of(label(term)));
    Table table = admin.tables().create(request);
    assertEquals(2, pendingTargets(term).size());

    Table cleared = reread(admin, table);
    cleared.setTags(List.of(SharedEntities.get().PII_SENSITIVE_TAG_LABEL));
    cleared.getColumns().get(0).setTags(List.of());
    admin.tables().update(table.getId().toString(), cleared);
    SdkClients.ingestionBotClient()
        .getHttpClient()
        .execute(
            HttpMethod.PATCH,
            "/v1/tables/%s".formatted(table.getId()),
            JsonUtils.readTree("[{\"op\":\"add\",\"path\":\"/tags\",\"value\":[]}]"),
            JsonNode.class);
    assertEquals(2, pendingTargets(term).size(), "writes that leave the term out keep it");

    admin
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/glossaryTerms/%s/assets/remove".formatted(term.getId()),
            new AddGlossaryToAssetsRequest()
                .withDryRun(false)
                .withAssets(List.of(table.getEntityReference())),
            BulkOperationResult.class);

    assertTrue(pendingTargets(term).isEmpty(), "assets/remove drops it on the table and columns");
  }

  /**
   * A pending-only removal changes nothing visible, yet still needs permission to edit the asset's
   * glossary terms: a user denied that on tables gets the asset back as failed, and it stays held.
   */
  @Test
  void aUserWhoCannotEditTheAssetCannotDropItsHeldTerm(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(admin, ns);
    CreateTable request = tableRequest(ns, schema(ns), "remove_denied");
    request.setTags(List.of(label(term)));
    Table table = admin.tables().create(request);
    assertEquals(1, pendingTargets(term).size());
    OpenMetadataClient denied =
        DenyPolicyPrincipals.clientDenied(
            ns.shortPrefix("deny_terms"), Entity.TABLE, MetadataOperation.EDIT_GLOSSARY_TERMS);

    BulkOperationResult result =
        denied
            .getHttpClient()
            .execute(
                HttpMethod.PUT,
                "/v1/glossaryTerms/%s/assets/remove".formatted(term.getId()),
                new AddGlossaryToAssetsRequest()
                    .withDryRun(false)
                    .withAssets(List.of(table.getEntityReference())),
                BulkOperationResult.class);

    assertEquals(1, result.getNumberOfRowsFailed(), () -> JsonUtils.pojoToJson(result));
    assertEquals(0, result.getNumberOfRowsPassed(), () -> JsonUtils.pojoToJson(result));
    assertEquals(1, pendingTargets(term).size(), "the held term stays");
  }

  /**
   * Removing a held term from a schema drops only the schema's own pending label; the tables under
   * it are other assets and keep theirs. A reference sent with only its id is enough.
   */
  @Test
  void removingTheTermFromAnAssetKeepsItOnAssetsNestedUnderIt(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(admin, ns);
    DatabaseSchema schema = schema(ns);
    DatabaseSchema fetched = admin.databaseSchemas().get(schema.getId().toString(), "tags");
    fetched.setTags(List.of(label(term)));
    admin.databaseSchemas().update(schema.getId().toString(), fetched);
    CreateTable request = tableRequest(ns, schema, "nested_held");
    request.setTags(List.of(label(term)));
    admin.tables().create(request);
    assertEquals(2, pendingTargets(term).size());

    admin
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/glossaryTerms/%s/assets/remove".formatted(term.getId()),
            new AddGlossaryToAssetsRequest()
                .withDryRun(false)
                .withAssets(
                    List.of(
                        new EntityReference().withId(schema.getId()).withType("databaseSchema"))),
            BulkOperationResult.class);

    assertEquals(1, pendingTargets(term).size(), "the table under the schema keeps its held term");
  }

  // A held term is answered as if it had not been sent: neither the write's answer nor a later read
  // shows it, and it waits as a pending label on each target it was held back from.
  private static void assertHeld(GlossaryTerm term, int pendingTargets, Object... reads) {
    for (Object read : reads) {
      assertFalse(
          JsonUtils.pojoToJson(read).contains(term.getFullyQualifiedName()),
          () -> "Held term %s shown in %s".formatted(term.getFullyQualifiedName(), read));
    }
    assertEquals(pendingTargets, pendingTargets(term).size());
  }

  private static List<String> pendingAssetIds(OpenMetadataClient client, GlossaryTerm term) {
    JsonNode page =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/glossaryTerms/%s/pendingAssets".formatted(term.getId()),
                null,
                JsonNode.class);
    List<String> assets = new ArrayList<>();
    page.get("data").forEach(asset -> assets.add(asset.get("id").asText()));
    return assets;
  }

  private static List<String> pendingTargets(GlossaryTerm term) {
    return Entity.getCollectionDAO()
        .tagUsageDAO()
        .listPendingTargetHashes(
            TagLabel.TagSource.GLOSSARY.ordinal(),
            FullyQualifiedName.buildHash(term.getFullyQualifiedName()),
            "",
            1000);
  }

  private static Table reread(OpenMetadataClient client, Table table) {
    return client.tables().get(table.getId().toString(), "tags,columns");
  }

  private static GlossaryTerm approvedTerm(OpenMetadataClient client, TestNamespace ns) {
    Glossary glossary = GlossaryTestFactory.createForStatusTests(ns);
    GlossaryTerm term = createTerm(client, glossary, ns.shortPrefix("term"));
    assertEquals(EntityStatus.APPROVED, term.getEntityStatus());
    return term;
  }

  private static GlossaryTerm deprecatedTerm(OpenMetadataClient client, TestNamespace ns) {
    return deprecate(client, approvedTerm(client, ns));
  }

  /** A term whose glossary has reviewers starts in Draft until they approve it. */
  private static GlossaryTerm draftTerm(
      OpenMetadataClient client, TestNamespace ns, TagLabel... tags) {
    Glossary glossary =
        ns.trackRoot(
            Entity.GLOSSARY,
            client
                .glossaries()
                .create(
                    new CreateGlossary()
                        .withName(ns.prefix(GlossaryTestFactory.STATUS_TEST_GLOSSARY_PREFIX))
                        .withDescription("Glossary whose terms start in Draft")
                        .withReviewers(
                            List.of(client.users().getByName("admin").getEntityReference()))));
    return createTerm(client, glossary, ns.shortPrefix("draft_term"), tags);
  }

  private static GlossaryTerm createTerm(
      OpenMetadataClient client, Glossary glossary, String name, TagLabel... tags) {
    return client
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(name)
                .withGlossary(glossary.getFullyQualifiedName())
                .withDescription("Term for approved-only tagging")
                .withTags(List.of(tags)));
  }

  private static GlossaryTerm deprecate(OpenMetadataClient client, GlossaryTerm term) {
    return setStatus(client, term, EntityStatus.DEPRECATED);
  }

  private static GlossaryTerm setStatus(
      OpenMetadataClient client, GlossaryTerm term, EntityStatus status) {
    GlossaryTerm fetched = client.glossaryTerms().get(term.getId().toString());
    fetched.setEntityStatus(status);
    GlossaryTerm updated = client.glossaryTerms().update(term.getId().toString(), fetched);
    assertEquals(status, updated.getEntityStatus());
    return updated;
  }

  // A test case's suite is named after its table, so the table's FQN has to stay short.
  private static DatabaseSchema shortSchema(TestNamespace ns) {
    String id = ns.uniqueShortId();
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName("pg_%s".formatted(id), ns);
    return DatabaseSchemaTestFactory.createSimpleWithName("s_%s".formatted(id), ns, service);
  }

  private static DatabaseSchema schema(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    return DatabaseSchemaTestFactory.createSimple(ns, service);
  }

  private static CreateTable tableRequest(TestNamespace ns, DatabaseSchema schema, String suffix) {
    List<Column> columns = new ArrayList<>();
    columns.add(new Column().withName("id").withDataType(ColumnDataType.BIGINT));
    return new CreateTable()
        .withName(ns.shortPrefix(suffix))
        .withDatabaseSchema(schema.getFullyQualifiedName())
        .withColumns(columns);
  }

  private static TagLabel label(GlossaryTerm term) {
    return new TagLabel()
        .withTagFQN(term.getFullyQualifiedName())
        .withSource(TagLabel.TagSource.GLOSSARY)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static boolean hasTerm(List<TagLabel> tags, GlossaryTerm term) {
    return hasTag(tags, term.getFullyQualifiedName());
  }

  private static boolean hasTag(List<TagLabel> tags, String tagFqn) {
    return tags != null && tags.stream().anyMatch(t -> tagFqn.equals(t.getTagFQN()));
  }
}
