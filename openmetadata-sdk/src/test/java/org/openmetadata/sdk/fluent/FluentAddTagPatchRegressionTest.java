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
package org.openmetadata.sdk.fluent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.Json;
import jakarta.json.JsonReader;
import java.io.StringReader;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.wrappers.FluentMlModel;
import org.openmetadata.sdk.fluent.wrappers.FluentPipeline;
import org.openmetadata.sdk.fluent.wrappers.FluentSearchIndex;
import org.openmetadata.sdk.fluent.wrappers.FluentTable;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.EntityServiceBase;
import org.openmetadata.sdk.services.dataassets.DashboardService;
import org.openmetadata.sdk.services.dataassets.MlModelService;
import org.openmetadata.sdk.services.dataassets.PipelineService;
import org.openmetadata.sdk.services.dataassets.SearchIndexService;
import org.openmetadata.sdk.services.dataassets.TableService;
import org.openmetadata.sdk.services.storages.SpreadsheetService;

class FluentAddTagPatchRegressionTest {
  private static final String EXISTING_TAG = "PII.Existing";
  private static final String NEW_TAG = "PII.Sensitive";
  private static final String TIER_TAG = "Tier.Gold";
  private static final String TABLES = "/v1/tables";
  private static final String PIPELINES = "/v1/pipelines";
  private static final String ML_MODELS = "/v1/mlmodels";
  private static final String SEARCH_INDEXES = "/v1/searchIndexes";
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final UUID id = UUID.randomUUID();
  private final HttpClient http = mock(HttpClient.class);
  private final OpenMetadataClient client = mock(OpenMetadataClient.class);

  @BeforeEach
  void configureServices() {
    when(client.tables()).thenReturn(new TableService(http));
    when(client.pipelines()).thenReturn(new PipelineService(http));
    when(client.mlModels()).thenReturn(new MlModelService(http));
    when(client.searchIndexes()).thenReturn(new SearchIndexService(http));
  }

  @Test
  void tableAddTagPreservesStoredTags() {
    serveTaggedAsset(TABLES, Table.class);
    Table fetched = client.tables().get(id);
    assertTags(fetched);
    Table saved = new FluentTable(fetched, client).addTag(NEW_TAG).save().get();
    assertTags(saved, EXISTING_TAG, NEW_TAG);
  }

  @Test
  void tableAddTagsPreservesBothAdditionsAndStoredTags() {
    serveTaggedAsset(TABLES, Table.class);
    Table saved =
        new FluentTable(client.tables().get(id), client).addTags(NEW_TAG, TIER_TAG).save().get();
    assertTags(saved, EXISTING_TAG, NEW_TAG, TIER_TAG);
  }

  @Test
  void tableAddTagPreservesExplicitlyFetchedTags() {
    serveTaggedAsset(TABLES, Table.class);
    Table fetched = client.tables().get(id.toString(), "tags");
    assertTags(fetched, EXISTING_TAG);
    assertTags(
        new FluentTable(fetched, client).addTag(NEW_TAG).save().get(), EXISTING_TAG, NEW_TAG);
  }

  @Test
  void clearingFetchedTagsRemovesStoredTags() {
    serveTaggedAsset(TABLES, Table.class);
    Table fetched = client.tables().get(id.toString(), "tags");
    assertTags(fetched, EXISTING_TAG);
    fetched.getTags().clear();
    assertTags(client.tables().update(id, fetched));
  }

  @Test
  void loadedTagsCanBeNarrowedWithoutACachedSnapshot() {
    ObjectNode stored = serveTaggedAsset(TABLES, Table.class);
    addStoredTag(stored, TIER_TAG);
    Table fetched = client.tables().get(id.toString(), "tags");
    fetched.getTags().removeIf(tag -> TIER_TAG.equals(tag.getTagFQN()));
    assertTags(new TableService(http).update(id, fetched), EXISTING_TAG);
  }

  @Test
  void reusingEntityAfterRemovalDoesNotDeleteTheNextTag() {
    ObjectNode stored = serveTaggedAsset(TABLES, Table.class);
    addStoredTag(stored, TIER_TAG);
    Table fetched = client.tables().get(id.toString(), "tags");
    fetched.getTags().removeIf(tag -> EXISTING_TAG.equals(tag.getTagFQN()));
    assertTags(client.tables().update(id, fetched), TIER_TAG);
    fetched.setDescription("updated");
    assertTags(client.tables().update(id, fetched), TIER_TAG);
  }

  @Test
  void copiedEntityCanStillClearFetchedOwners() {
    ObjectNode stored = serveTaggedAsset(TABLES, Table.class);
    stored
        .putArray("owners")
        .addObject()
        .put("id", UUID.randomUUID().toString())
        .put("type", "user");
    Table original = client.tables().get(id.toString(), "tags,owners");
    assertTags(
        client.tables().list(new ListParams().setFields("tags")).getData().getFirst(),
        EXISTING_TAG);
    Table copy = MAPPER.convertValue(original, Table.class);
    copy.setOwners(null);
    client.tables().update(id, copy);
    assertFalse(stored.hasNonNull("owners"));
  }

  @Test
  void staleRemovalCannotDeleteADifferentTagAtTheSameIndex() {
    ObjectNode stored = serveTaggedAsset(TABLES, Table.class);
    addStoredTag(stored, TIER_TAG);
    Table fetched = client.tables().get(id.toString(), "tags");
    fetched.getTags().removeFirst();
    stored.withArray("tags").remove(0);

    assertThrows(OpenMetadataException.class, () -> client.tables().update(id, fetched));
    assertTags(MAPPER.convertValue(stored, Table.class), TIER_TAG);
  }

  @Test
  void omittingTagsFromAPartialUpdatePreservesStoredTags() {
    serveTaggedAsset(TABLES, Table.class);
    Table partial = client.tables().get(id);
    partial.setTags(null);
    partial.setDescription("updated");
    assertTags(client.tables().update(id, partial), EXISTING_TAG);
  }

  @Test
  void editingPartialCopyAfterFullFetchPreservesStoredTags() {
    serveTaggedAsset(TABLES, Table.class);
    Table partial = client.tables().get(id);
    assertTags(client.tables().get(id.toString(), "tags"), EXISTING_TAG);
    partial.setDescription("updated");
    Table saved = client.tables().update(id, partial);
    assertEquals("updated", saved.getDescription());
    assertTags(saved, EXISTING_TAG);
  }

  @Test
  void detachedTableDistinguishesUntouchedTagsFromAnExplicitClear() {
    serveTaggedAsset(TABLES, Table.class);
    Table detached = new Table().withId(id).withName("orders").withDescription("updated");
    assertTags(client.tables().update(id, detached), EXISTING_TAG);
    detached.setTags(List.of());
    assertTags(client.tables().update(id, detached));
  }

  @Test
  void partialTableRetainsStoredTagsAfterSnapshotEviction() {
    serveTaggedAsset(TABLES, Table.class);
    String prefix = TABLES + "/";
    when(http.execute(eq(HttpMethod.GET), startsWith(prefix), isNull(), eq(Table.class)))
        .thenAnswer(
            invocation -> {
              String path = invocation.getArgument(1);
              return new Table()
                  .withId(UUID.fromString(path.substring(prefix.length())))
                  .withName("orders");
            });
    TableService tables = client.tables();
    Table fetched = tables.get(id);
    // The SDK retains at most 500 snapshots per service.
    for (int index = 0; index < 501; index++) {
      tables.get(UUID.randomUUID());
    }

    fetched.setDescription("updated");
    Table saved = tables.update(id, fetched);
    assertEquals("updated", saved.getDescription());
    assertTags(saved, EXISTING_TAG);
  }

  @Test
  void pipelineAddTagsPreservesStoredTags() {
    serveTaggedAsset(PIPELINES, Pipeline.class);
    assertTags(
        new FluentPipeline(client.pipelines().get(id), client).addTags(NEW_TAG).save(),
        EXISTING_TAG,
        NEW_TAG);
  }

  @Test
  void mlModelAddTagPreservesStoredTags() {
    serveTaggedAsset(ML_MODELS, MlModel.class);
    assertTags(
        new FluentMlModel(client.mlModels().get(id), client).addTag(NEW_TAG).save(),
        EXISTING_TAG,
        NEW_TAG);
  }

  @Test
  void searchIndexAddTagPreservesStoredTags() {
    serveTaggedAsset(SEARCH_INDEXES, SearchIndex.class);
    assertTags(
        new FluentSearchIndex(client.searchIndexes().get(id), client).addTag(NEW_TAG).save(),
        EXISTING_TAG,
        NEW_TAG);
  }

  @Test
  void descriptionEditsOnListResultsPreserveStoredTags() {
    assertListEditPreservesTags(TABLES, Table.class, client.tables());
    assertListEditPreservesTags(PIPELINES, Pipeline.class, client.pipelines());
    assertListEditPreservesTags(ML_MODELS, MlModel.class, client.mlModels());
    assertListEditPreservesTags(SEARCH_INDEXES, SearchIndex.class, client.searchIndexes());
    assertListEditPreservesTags("/v1/dashboards", Dashboard.class, new DashboardService(http));
  }

  @Test
  void directSpreadsheetUpdatePreservesUnrequestedTags() {
    serveTaggedAsset("/v1/drives/spreadsheets", Spreadsheet.class);
    SpreadsheetService spreadsheets = new SpreadsheetService(http);
    Spreadsheet fetched = spreadsheets.get(id);
    fetched.setTags(List.of(new TagLabel().withTagFQN(NEW_TAG)));
    assertTags(spreadsheets.update(id, fetched), EXISTING_TAG, NEW_TAG);
  }

  @Test
  void detachedTagAdditionsPreserveStoredTags() {
    serveTaggedAsset(TABLES, Table.class);
    Table detached =
        new Table()
            .withId(id)
            .withName("orders")
            .withTags(List.of(new TagLabel().withTagFQN(NEW_TAG)));
    assertTags(client.tables().update(id, detached), EXISTING_TAG, NEW_TAG);
  }

  private <T extends EntityInterface<?>> void assertListEditPreservesTags(
      String path, Class<T> type, EntityServiceBase<T> service) {
    serveTaggedAsset(path, type);
    T listed = service.list().getData().getFirst();
    listed.setDescription("updated");
    T saved = service.update(id, listed);
    assertEquals("updated", saved.getDescription());
    assertTags(saved, EXISTING_TAG);
  }

  private <T> ObjectNode serveTaggedAsset(String collection, Class<T> type) {
    String path = collection + "/" + id;
    ObjectNode partial = MAPPER.createObjectNode().put("id", id.toString()).put("name", "orders");
    ObjectNode stored = partial.deepCopy();
    addStoredTag(stored, EXISTING_TAG);

    when(http.execute(HttpMethod.GET, path, null, type))
        .thenAnswer(invocation -> MAPPER.treeToValue(partial, type));
    when(http.execute(eq(HttpMethod.GET), eq(path), isNull(), eq(type), any(RequestOptions.class)))
        .thenAnswer(
            invocation -> {
              RequestOptions options = invocation.getArgument(4);
              List<String> fields =
                  Arrays.asList(options.getQueryParams().getOrDefault("fields", "").split(","));
              return MAPPER.treeToValue(
                  fields.contains("tags") || fields.contains("*") ? stored : partial, type);
            });
    when(http.executeForString(eq(HttpMethod.GET), eq(collection), isNull(), any()))
        .thenAnswer(
            invocation -> {
              RequestOptions options = invocation.getArgument(3);
              ObjectNode item = partial.deepCopy();
              if ("tags".equals(options.getQueryParams().get("fields"))) {
                item.set("tags", stored.get("tags"));
              }
              ObjectNode page = MAPPER.createObjectNode();
              page.putArray("data").add(item);
              return page.toString();
            });
    when(http.execute(eq(HttpMethod.PATCH), eq(path), any(JsonNode.class), eq(type), isNull()))
        .thenAnswer(
            invocation -> {
              JsonNode patch = invocation.getArgument(2);
              try (JsonReader operations = Json.createReader(new StringReader(patch.toString()));
                  JsonReader entity = Json.createReader(new StringReader(stored.toString()))) {
                String patched =
                    Json.createPatch(operations.readArray()).apply(entity.readObject()).toString();
                stored.removeAll().setAll(MAPPER.readValue(patched, ObjectNode.class));
                return MAPPER.treeToValue(stored, type);
              }
            });
    return stored;
  }

  private static void addStoredTag(ObjectNode stored, String fqn) {
    JsonNode tag =
        MAPPER.valueToTree(
            new TagLabel().withTagFQN(fqn).withSource(TagLabel.TagSource.CLASSIFICATION));
    stored.withArray("tags").add(tag);
  }

  private static void assertTags(EntityInterface<?> entity, String... expected) {
    assertEquals(
        Arrays.stream(expected).sorted().toList(),
        entity.getTags().stream().map(TagLabel::getTagFQN).sorted().toList());
  }
}
