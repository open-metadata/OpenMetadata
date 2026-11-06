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
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.AddGlossaryToAssetsRequest;
import org.openmetadata.schema.api.data.BulkColumnUpdatePreview;
import org.openmetadata.schema.api.data.BulkColumnUpdateRequest;
import org.openmetadata.schema.api.data.ColumnUpdate;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModel;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * Only an Approved glossary term can be applied to an asset, whichever API applies it — the UI
 * only offers Approved terms, and the API has to hold the same line. A term already on an asset
 * stays there when it later leaves Approved, so writes that carry it unchanged keep working.
 *
 * <p>Glossaries are created under {@link GlossaryTestFactory#STATUS_TEST_GLOSSARY_PREFIX}, which the
 * suite excludes from the approval workflow, so each term keeps the stage the test gives it.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class GlossaryTermApprovedTaggingIT {

  private static final String NOT_APPROVED = "Only Approved glossary terms can be applied";

  @Test
  void createTableWithDeprecatedTerm_isRejected(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);

    CreateTable request = tableRequest(ns, schema(ns), "create_dep");
    request.setTags(List.of(label(term)));

    assertRejected(() -> client.tables().create(request), term);
  }

  @Test
  void createTableWithDraftTermOnColumn_isRejected(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = draftTerm(client, ns);
    assertEquals(EntityStatus.DRAFT, term.getEntityStatus());

    CreateTable request = tableRequest(ns, schema(ns), "create_draft_col");
    request.getColumns().get(0).setTags(List.of(label(term)));

    assertRejected(() -> client.tables().create(request), term);
  }

  @Test
  void putTableAddingDeprecatedTerm_isRejected(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    CreateTable request = tableRequest(ns, schema(ns), "put_dep");
    client.tables().create(request);

    request.setTags(List.of(label(term)));

    assertRejected(() -> client.tables().createOrUpdate(request), term);
  }

  @Test
  void patchTableAddingDeprecatedTerm_isRejected(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    Table table = client.tables().create(tableRequest(ns, schema(ns), "patch_dep"));

    Table fetched = client.tables().get(table.getId().toString(), "tags,columns");
    fetched.setTags(List.of(label(term)));

    assertRejected(() -> client.tables().update(table.getId().toString(), fetched), term);
  }

  @Test
  void patchColumnAddingDraftTerm_isRejected(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = draftTerm(client, ns);
    Table table = client.tables().create(tableRequest(ns, schema(ns), "patch_draft_col"));

    Table fetched = client.tables().get(table.getId().toString(), "tags,columns");
    fetched.getColumns().get(0).setTags(List.of(label(term)));

    assertRejected(() -> client.tables().update(table.getId().toString(), fetched), term);
  }

  @Test
  void bulkAddDeprecatedTermToAssets_isRejected(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    Table table = client.tables().create(tableRequest(ns, schema(ns), "bulk_add_dep"));

    AddGlossaryToAssetsRequest request =
        new AddGlossaryToAssetsRequest()
            .withDryRun(false)
            .withAssets(List.of(table.getEntityReference()));

    assertRejected(
        () ->
            client
                .getHttpClient()
                .execute(
                    HttpMethod.PUT,
                    "/v1/glossaryTerms/%s/assets/add".formatted(term.getId()),
                    request,
                    BulkOperationResult.class),
        term);
    Table after = client.tables().get(table.getId().toString(), "tags");
    assertTrue(after.getTags() == null || after.getTags().isEmpty());
  }

  @Test
  void bulkPutOfTablesWithDeprecatedTerm_failsThatTableOnly(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    DatabaseSchema schema = schema(ns);
    CreateTable tagged = tableRequest(ns, schema, "bulk_put_dep");
    tagged.setTags(List.of(label(term)));
    CreateTable plain = tableRequest(ns, schema, "bulk_put_plain");

    BulkOperationResult result = client.tables().bulkCreateOrUpdate(List.of(tagged, plain));

    assertEquals(ApiStatus.PARTIAL_SUCCESS, result.getStatus());
    assertEquals(1, result.getNumberOfRowsFailed());
    assertTrue(
        result.getFailedRequest().get(0).getMessage().contains(NOT_APPROVED),
        () -> "Unexpected failure: %s".formatted(result.getFailedRequest().get(0).getMessage()));
  }

  @Test
  void dataModelBringingDeprecatedTermToColumn_isRejected(TestNamespace ns) {
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

    assertRejected(() -> client.tables().updateDataModel(table.getId(), dataModel), term);
  }

  /** Holding a term on one column does not let it be applied to another. */
  @Test
  void termHeldOnOneColumn_cannotBeAddedToAnother(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = approvedTerm(client, ns);
    CreateTable request = tableRequest(ns, schema(ns), "other_column");
    request.getColumns().add(new Column().withName("total").withDataType(ColumnDataType.INT));
    request.getColumns().get(0).setTags(List.of(label(term)));
    Table table = client.tables().create(request);
    deprecate(client, term);

    Table fetched = client.tables().get(table.getId().toString(), "tags,columns");
    fetched.getColumns().get(1).setTags(List.of(label(term)));
    assertRejected(() -> client.tables().update(table.getId().toString(), fetched), term);

    Table onTable = client.tables().get(table.getId().toString(), "tags,columns");
    onTable.setTags(List.of(label(term)));
    assertRejected(() -> client.tables().update(table.getId().toString(), onTable), term);
  }

  @Test
  void columnApiAddingDeprecatedTerm_isRejected(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    GlossaryTerm term = deprecatedTerm(client, ns);
    Table table = client.tables().create(tableRequest(ns, schema(ns), "column_api_dep"));
    String columnFqn = table.getColumns().get(0).getFullyQualifiedName();

    assertRejected(
        () ->
            client
                .tables()
                .updateColumn(columnFqn, new UpdateColumn().withTags(List.of(label(term)))),
        term);
  }

  @Test
  void columnBulkUpdatePreviewWithDeprecatedTerm_isRejected(TestNamespace ns) {
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

    assertRejected(
        () ->
            client
                .getHttpClient()
                .execute(
                    HttpMethod.POST,
                    "/v1/columns/bulk-update-preview",
                    request,
                    BulkColumnUpdatePreview.class),
        term);
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

  // The SDK's update() wraps the server's 400 in a generic OpenMetadataException, so the
  // rejection is checked on the root cause.
  private static void assertRejected(Runnable call, GlossaryTerm term) {
    OpenMetadataException thrown = assertThrows(OpenMetadataException.class, call::run);
    Throwable rejection = ExceptionUtils.getRootCause(thrown);
    assertInstanceOf(InvalidRequestException.class, rejection);
    assertTrue(
        rejection.getMessage().contains(NOT_APPROVED)
            && rejection.getMessage().contains(term.getFullyQualifiedName()),
        () -> "Unexpected rejection: %s".formatted(rejection.getMessage()));
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
  private static GlossaryTerm draftTerm(OpenMetadataClient client, TestNamespace ns) {
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
    return createTerm(client, glossary, ns.shortPrefix("draft_term"));
  }

  private static GlossaryTerm createTerm(
      OpenMetadataClient client, Glossary glossary, String name) {
    return client
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(name)
                .withGlossary(glossary.getFullyQualifiedName())
                .withDescription("Term for approved-only tagging"));
  }

  private static GlossaryTerm deprecate(OpenMetadataClient client, GlossaryTerm term) {
    GlossaryTerm fetched = client.glossaryTerms().get(term.getId().toString());
    fetched.setEntityStatus(EntityStatus.DEPRECATED);
    GlossaryTerm deprecated = client.glossaryTerms().update(term.getId().toString(), fetched);
    assertEquals(EntityStatus.DEPRECATED, deprecated.getEntityStatus());
    return deprecated;
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
    return tags != null
        && tags.stream().anyMatch(t -> term.getFullyQualifiedName().equals(t.getTagFQN()));
  }
}
