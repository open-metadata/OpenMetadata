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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.json.Json;
import jakarta.json.JsonPatch;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.wrappers.FluentMlModel;
import org.openmetadata.sdk.fluent.wrappers.FluentPipeline;
import org.openmetadata.sdk.fluent.wrappers.FluentSearchIndex;
import org.openmetadata.sdk.fluent.wrappers.FluentTable;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.dataassets.MlModelService;
import org.openmetadata.sdk.services.dataassets.PipelineService;
import org.openmetadata.sdk.services.dataassets.SearchIndexService;
import org.openmetadata.sdk.services.dataassets.TableService;

/**
 * Regression tests pinning the fix for the silent tag-data-loss bug in the fluent wrappers'
 * {@code addTag}/{@code addTags} + {@code save()} PATCH flow.
 *
 * <p>Background: every fluent wrapper mutates the locally-held entity and hands it to {@link
 * org.openmetadata.sdk.services.EntityServiceBase#update}, which diffs an in-memory snapshot
 * against the mutated entity and sends a JSON-Patch. When the entity schema's top-level {@code
 * tags} property declared {@code "default": null}, the generated POJO initialized {@code tags} to
 * {@code null}. After a normal {@code get()} with no {@code fields=tags}, the SDK's {@code
 * NON_NULL} serialization omitted {@code tags} from the snapshot, so adding one tag produced a
 * wholesale {@code {"op":"add","path":"/tags","value":[<only the new tag>]}}, which the server
 * applied as a <b>replacement</b> of the stored tag set — silently deleting every previously saved
 * tag while the call returned HTTP 200.
 *
 * <p>The fix sets {@code "default": []} on the top-level {@code tags} of {@code table.json}, {@code
 * pipeline.json}, {@code mlmodel.json} and {@code searchIndex.json} (mirroring commit {@code
 * 88c8fb48f3}, which already did this for the other entity schemas). The generated POJO now
 * initializes {@code tags} to an empty list, so the snapshot carries {@code "tags": []} and the
 * diff emits index-level {@code add /tags/N} ops that <b>insert</b> into the server's stored array
 * rather than replacing it.
 *
 * <p>Each test uses a real service subclass ({@link TableService}/{@link PipelineService}/{@link
 * MlModelService}/{@link SearchIndexService}) backed by a mocked {@link HttpClient} so it
 * exercises the actual {@code EntityServiceBase.update} snapshot+diff+PATCH path users hit, and
 * asserts on the wire PATCH body captured at the HTTP boundary. The captured patch is then
 * applied to a simulated server-stored entity (carrying its pre-existing tags) to prove no data
 * loss occurs end-to-end.
 */
class FluentAddTagPatchRegressionTest {

  private static final String EXISTING_TAG_FQN = "PII.Existing";
  private static final String NEW_TAG_FQN = "PII.Sensitive";

  /** NON_NULL mapper, matching {@link org.openmetadata.sdk.services.EntityServiceBase}. */
  private static final ObjectMapper NON_NULL_MAPPER =
      new ObjectMapper().setSerializationInclusion(JsonInclude.Include.NON_NULL);

  @Mock private OpenMetadataClient mockClient;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
  }

  /**
   * The fix starts in the generated POJO: the {@code tags} field of each affected entity must
   * initialize to an empty list (not {@code null}) so the NON_NULL snapshot always carries {@code
   * "tags": []}. If any of these regress to {@code null}, the wholesale-replace bug returns.
   */
  @Test
  void pojoTagsFieldInitializesToEmptyListForAllAffectedEntities() {
    assertTagsInitializedToEmpty(new Table(), "Table");
    assertTagsInitializedToEmpty(new Pipeline(), "Pipeline");
    assertTagsInitializedToEmpty(new MlModel(), "MlModel");
    assertTagsInitializedToEmpty(new SearchIndex(), "SearchIndex");
  }

  private static void assertTagsInitializedToEmpty(Object entity, String entityName) {
    @SuppressWarnings("unchecked")
    List<TagLabel> tags = (List<TagLabel>) invokeGetter(entity, "getTags");
    assertNotNull(tags, () -> entityName + ".tags must not be null (schema default must be [])");
    assertTrue(tags.isEmpty(), () -> entityName + ".tags must initialize to an empty list");
  }

  private static Object invokeGetter(Object entity, String getter) {
    try {
      return entity.getClass().getMethod(getter).invoke(entity);
    } catch (ReflectiveOperationException e) {
      throw new AssertionError("Unable to call " + getter + " on " + entity.getClass(), e);
    }
  }

  // ==================== FluentTable.addTag (the primary bug) ====================

  /**
   * Reproduce the bug scenario end-to-end: fetch an existing table with no {@code fields=tags}
   * (snapshot carries no tags), add a single tag via the fluent API, save() it, and verify the
   * emitted PATCH is an index-level {@code add /tags/N} that, when applied to the server's stored
   * entity (which still has its pre-existing tags), preserves those tags instead of wiping them.
   */
  @Test
  void fluentTableAddTag_emitsIndexLevelPatchAndPreservesStoredTags() throws Exception {
    String tableId = UUID.randomUUID().toString();
    Table fetchedFromServer = new Table().withId(UUID.fromString(tableId)).withName("orders");
    assertEquals(
        new ArrayList<>(),
        fetchedFromServer.getTags(),
        "post-fix POJO default: tags starts as an empty list, not null");

    HttpClient mockHttp = stubTableService();
    when(mockHttp.execute(
            eq(HttpMethod.GET), eq("/v1/tables/" + tableId), isNull(), eq(Table.class)))
        .thenReturn(fetchedFromServer);
    ArgumentCaptor<JsonNode> patchCaptor = ArgumentCaptor.forClass(JsonNode.class);
    Table serverResponse =
        new Table()
            .withId(UUID.fromString(tableId))
            .withName("orders")
            .withTags(List.of(tagLabel(NEW_TAG_FQN)));
    when(mockHttp.execute(
            eq(HttpMethod.PATCH),
            eq("/v1/tables/" + tableId),
            patchCaptor.capture(),
            eq(Table.class),
            isNull()))
        .thenReturn(serverResponse);

    // Realistic user flow: get() populates the SDK snapshot, then addTag().save() PATCHes.
    Table fetched = mockClient.tables().get(tableId);
    new FluentTable(fetched, mockClient).addTag(NEW_TAG_FQN).save();

    JsonNode patch = patchCaptor.getValue();
    // The fix: the patch must insert at an index, not replace the whole array.
    assertTrue(
        hasAddOpWithPathPrefix(patch, "/tags/"),
        () -> "expected an index-level add /tags/N op but patch was: " + patch);
    assertFalse(
        hasOp(patch, "add", "/tags"),
        () ->
            "wholesale add /tags op silently replaces stored tags (the bug); patch was: " + patch);
    assertFalse(
        hasOp(patch, "replace", "/tags"),
        () -> "replace /tags op would also wipe stored tags; patch was: " + patch);

    // End-to-end guarantee: applying the SDK's patch to the server's stored entity (which
    // carries its pre-existing tags) must retain those tags — no silent data loss.
    Table serverStored =
        new Table()
            .withId(UUID.fromString(tableId))
            .withName("orders")
            .withTags(List.of(tagLabel(EXISTING_TAG_FQN)));
    List<String> resultingTagFqns = tagFqnsOf(applyPatch(patch, serverStored));
    assertTrue(
        resultingTagFqns.contains(NEW_TAG_FQN),
        () -> "new tag must be present after PATCH; got " + resultingTagFqns);
    assertTrue(
        resultingTagFqns.contains(EXISTING_TAG_FQN),
        () ->
            "pre-existing stored tag must survive the fluent addTag().save() PATCH; got "
                + resultingTagFqns);
  }

  /** Adding multiple tags must emit multiple index-level inserts, never a wholesale replace. */
  @Test
  void fluentTableAddTags_multiple_emitsIndexLevelInsertsNotWholesaleReplace() throws Exception {
    String tableId = UUID.randomUUID().toString();
    Table fetchedFromServer = new Table().withId(UUID.fromString(tableId)).withName("orders");

    HttpClient mockHttp = stubTableService();
    when(mockHttp.execute(
            eq(HttpMethod.GET), eq("/v1/tables/" + tableId), isNull(), eq(Table.class)))
        .thenReturn(fetchedFromServer);
    ArgumentCaptor<JsonNode> patchCaptor = ArgumentCaptor.forClass(JsonNode.class);
    when(mockHttp.execute(
            eq(HttpMethod.PATCH),
            eq("/v1/tables/" + tableId),
            patchCaptor.capture(),
            eq(Table.class),
            isNull()))
        .thenReturn(fetchedFromServer);

    Table fetched = mockClient.tables().get(tableId);
    new FluentTable(fetched, mockClient).addTags(NEW_TAG_FQN, "Tier.Gold").save();

    JsonNode patch = patchCaptor.getValue();
    long tagAddOps = patchOpsMatching(patch, "add", "/tags/").size();
    assertTrue(
        tagAddOps >= 2,
        () -> "expected >=2 index-level add /tags/N ops for addTags(x2); patch was: " + patch);
    assertFalse(
        hasOp(patch, "add", "/tags"),
        () -> "wholesale add /tags op would silently drop stored tags; patch was: " + patch);
  }

  /**
   * Regression guard: when the entity IS fetched with {@code fields=tags}, the snapshot carries the
   * existing tags and the diff must append the new tag — no deletion of stored tags either way.
   */
  @Test
  void fluentTableAddTag_afterFetchingWithFieldsTags_appendsToExistingSnapshot() throws Exception {
    String tableId = UUID.randomUUID().toString();
    // Jackson deserializes JSON arrays into mutable ArrayLists; mirror that here so addTag() can
    // append (List.of would be immutable and would throw UnsupportedOperationException).
    Table fetchedWithTags =
        new Table()
            .withId(UUID.fromString(tableId))
            .withName("orders")
            .withTags(new ArrayList<>(List.of(tagLabel(EXISTING_TAG_FQN))));

    HttpClient mockHttp = stubTableService();
    // GET with fields=tags — snapshot records the stored tag list.
    when(mockHttp.execute(
            eq(HttpMethod.GET), eq("/v1/tables/" + tableId), isNull(), eq(Table.class), any()))
        .thenReturn(fetchedWithTags);
    ArgumentCaptor<JsonNode> patchCaptor = ArgumentCaptor.forClass(JsonNode.class);
    when(mockHttp.execute(
            eq(HttpMethod.PATCH),
            eq("/v1/tables/" + tableId),
            patchCaptor.capture(),
            eq(Table.class),
            isNull()))
        .thenReturn(fetchedWithTags);

    Table fetched = mockClient.tables().get(tableId, "tags");
    new FluentTable(fetched, mockClient).addTag(NEW_TAG_FQN).save();

    JsonNode patch = patchCaptor.getValue();
    assertTrue(
        hasAddOpWithPathPrefix(patch, "/tags/"),
        () -> "expected an append add /tags/N op; patch was: " + patch);
    assertFalse(
        hasOp(patch, "remove", "/tags"),
        () -> "must not remove the existing stored tag when appending; patch was: " + patch);
    assertFalse(
        hasRemoveOpWithPathPrefix(patch, "/tags/"),
        () -> "must not remove any stored tag element when appending; patch was: " + patch);

    // Applying the append to the stored entity must keep the existing tag AND add the new one.
    Table serverStored =
        new Table()
            .withId(UUID.fromString(tableId))
            .withName("orders")
            .withTags(new ArrayList<>(List.of(tagLabel(EXISTING_TAG_FQN))));
    List<String> resultingTagFqns = tagFqnsOf(applyPatch(patch, serverStored));
    assertTrue(resultingTagFqns.contains(EXISTING_TAG_FQN));
    assertTrue(resultingTagFqns.contains(NEW_TAG_FQN));
    assertEquals(2, resultingTagFqns.size());
  }

  // ==================== FluentPipeline.addTags ====================

  @Test
  void fluentPipelineAddTags_emitsIndexLevelPatchNotWholesaleReplace() throws Exception {
    String pipelineId = UUID.randomUUID().toString();
    Pipeline fetchedFromServer =
        new Pipeline().withId(UUID.fromString(pipelineId)).withName("ingest_orders");

    HttpClient mockHttp = stubPipelineService();
    when(mockHttp.execute(
            eq(HttpMethod.GET), eq("/v1/pipelines/" + pipelineId), isNull(), eq(Pipeline.class)))
        .thenReturn(fetchedFromServer);
    ArgumentCaptor<JsonNode> patchCaptor = ArgumentCaptor.forClass(JsonNode.class);
    when(mockHttp.execute(
            eq(HttpMethod.PATCH),
            eq("/v1/pipelines/" + pipelineId),
            patchCaptor.capture(),
            eq(Pipeline.class),
            isNull()))
        .thenReturn(fetchedFromServer);

    Pipeline fetched = mockClient.pipelines().get(pipelineId);
    new FluentPipeline(fetched, mockClient).addTags(NEW_TAG_FQN).save();

    JsonNode patch = patchCaptor.getValue();
    assertTrue(
        hasAddOpWithPathPrefix(patch, "/tags/"),
        () -> "expected index-level add /tags/N op; patch was: " + patch);
    assertFalse(
        hasOp(patch, "add", "/tags"),
        () -> "wholesale add /tags op would drop stored pipeline tags; patch was: " + patch);

    Pipeline serverStored =
        new Pipeline()
            .withId(UUID.fromString(pipelineId))
            .withName("ingest_orders")
            .withTags(List.of(tagLabel(EXISTING_TAG_FQN)));
    List<String> resultingTagFqns = tagFqnsOf(applyPatch(patch, serverStored));
    assertTrue(resultingTagFqns.contains(NEW_TAG_FQN));
    assertTrue(
        resultingTagFqns.contains(EXISTING_TAG_FQN),
        () -> "pre-existing pipeline tag must survive; got " + resultingTagFqns);
  }

  // ==================== FluentMlModel.addTag ====================

  @Test
  void fluentMlModelAddTag_emitsIndexLevelPatchNotWholesaleReplace() throws Exception {
    String modelId = UUID.randomUUID().toString();
    MlModel fetchedFromServer = new MlModel().withId(UUID.fromString(modelId)).withName("scorer");

    HttpClient mockHttp = stubMlModelService();
    when(mockHttp.execute(
            eq(HttpMethod.GET), eq("/v1/mlmodels/" + modelId), isNull(), eq(MlModel.class)))
        .thenReturn(fetchedFromServer);
    ArgumentCaptor<JsonNode> patchCaptor = ArgumentCaptor.forClass(JsonNode.class);
    when(mockHttp.execute(
            eq(HttpMethod.PATCH),
            eq("/v1/mlmodels/" + modelId),
            patchCaptor.capture(),
            eq(MlModel.class),
            isNull()))
        .thenReturn(fetchedFromServer);

    MlModel fetched = mockClient.mlModels().get(modelId);
    new FluentMlModel(fetched, mockClient).addTag(NEW_TAG_FQN).save();

    JsonNode patch = patchCaptor.getValue();
    assertTrue(
        hasAddOpWithPathPrefix(patch, "/tags/"),
        () -> "expected index-level add /tags/N op; patch was: " + patch);
    assertFalse(
        hasOp(patch, "add", "/tags"),
        () -> "wholesale add /tags op would drop stored mlmodel tags; patch was: " + patch);

    MlModel serverStored =
        new MlModel()
            .withId(UUID.fromString(modelId))
            .withName("scorer")
            .withTags(List.of(tagLabel(EXISTING_TAG_FQN)));
    List<String> resultingTagFqns = tagFqnsOf(applyPatch(patch, serverStored));
    assertTrue(resultingTagFqns.contains(NEW_TAG_FQN));
    assertTrue(
        resultingTagFqns.contains(EXISTING_TAG_FQN),
        () -> "pre-existing mlmodel tag must survive; got " + resultingTagFqns);
  }

  // ==================== FluentSearchIndex.addTag ====================

  @Test
  void fluentSearchIndexAddTag_emitsIndexLevelPatchNotWholesaleReplace() throws Exception {
    String indexId = UUID.randomUUID().toString();
    SearchIndex fetchedFromServer =
        new SearchIndex().withId(UUID.fromString(indexId)).withName("orders_index");

    HttpClient mockHttp = stubSearchIndexService();
    when(mockHttp.execute(
            eq(HttpMethod.GET),
            eq("/v1/searchIndexes/" + indexId),
            isNull(),
            eq(SearchIndex.class)))
        .thenReturn(fetchedFromServer);
    ArgumentCaptor<JsonNode> patchCaptor = ArgumentCaptor.forClass(JsonNode.class);
    when(mockHttp.execute(
            eq(HttpMethod.PATCH),
            eq("/v1/searchIndexes/" + indexId),
            patchCaptor.capture(),
            eq(SearchIndex.class),
            isNull()))
        .thenReturn(fetchedFromServer);

    SearchIndex fetched = mockClient.searchIndexes().get(indexId);
    new FluentSearchIndex(fetched, mockClient).addTag(NEW_TAG_FQN).save();

    JsonNode patch = patchCaptor.getValue();
    assertTrue(
        hasAddOpWithPathPrefix(patch, "/tags/"),
        () -> "expected index-level add /tags/N op; patch was: " + patch);
    assertFalse(
        hasOp(patch, "add", "/tags"),
        () -> "wholesale add /tags op would drop stored searchIndex tags; patch was: " + patch);

    SearchIndex serverStored =
        new SearchIndex()
            .withId(UUID.fromString(indexId))
            .withName("orders_index")
            .withTags(List.of(tagLabel(EXISTING_TAG_FQN)));
    List<String> resultingTagFqns = tagFqnsOf(applyPatch(patch, serverStored));
    assertTrue(resultingTagFqns.contains(NEW_TAG_FQN));
    assertTrue(
        resultingTagFqns.contains(EXISTING_TAG_FQN),
        () -> "pre-existing searchIndex tag must survive; got " + resultingTagFqns);
  }

  // ==================== service wiring helpers (real service + mocked HTTP) ====================

  /** Wires {@code mockClient.tables()} to a real {@link TableService} backed by a fresh mock HTTP. */
  private HttpClient stubTableService() {
    HttpClient mockHttp = mock(HttpClient.class);
    when(mockClient.tables()).thenReturn(new TableService(mockHttp));
    return mockHttp;
  }

  private HttpClient stubPipelineService() {
    HttpClient mockHttp = mock(HttpClient.class);
    when(mockClient.pipelines()).thenReturn(new PipelineService(mockHttp));
    return mockHttp;
  }

  private HttpClient stubMlModelService() {
    HttpClient mockHttp = mock(HttpClient.class);
    when(mockClient.mlModels()).thenReturn(new MlModelService(mockHttp));
    return mockHttp;
  }

  private HttpClient stubSearchIndexService() {
    HttpClient mockHttp = mock(HttpClient.class);
    when(mockClient.searchIndexes()).thenReturn(new SearchIndexService(mockHttp));
    return mockHttp;
  }

  // ==================== patch op + apply helpers ====================

  private static TagLabel tagLabel(String tagFQN) {
    return new TagLabel().withTagFQN(tagFQN).withSource(TagLabel.TagSource.CLASSIFICATION);
  }

  private static boolean hasOp(JsonNode patch, String op, String path) {
    if (patch == null || !patch.isArray()) {
      return false;
    }
    for (JsonNode operation : patch) {
      if (op.equals(operation.path("op").asText())
          && path.equals(operation.path("path").asText())) {
        return true;
      }
    }
    return false;
  }

  private static boolean hasAddOpWithPathPrefix(JsonNode patch, String pathPrefix) {
    return !patchOpsMatching(patch, "add", pathPrefix).isEmpty();
  }

  private static boolean hasRemoveOpWithPathPrefix(JsonNode patch, String pathPrefix) {
    return !patchOpsMatching(patch, "remove", pathPrefix).isEmpty();
  }

  private static List<JsonNode> patchOpsMatching(JsonNode patch, String op, String pathPrefix) {
    List<JsonNode> matches = new ArrayList<>();
    if (patch == null || !patch.isArray()) {
      return matches;
    }
    for (JsonNode operation : patch) {
      if (op.equals(operation.path("op").asText())
          && operation.path("path").asText().startsWith(pathPrefix)) {
        matches.add(operation);
      }
    }
    return matches;
  }

  /**
   * Applies the SDK's captured Jackson {@code JsonNode} patch to a simulated server-stored entity,
   * mirroring how the server (jakarta.json / Parsson) would apply it.
   */
  private static JsonNode applyPatch(JsonNode patch, Object serverStoredEntity) throws Exception {
    JsonPatch jsonPatch =
        Json.createPatch(Json.createReader(new StringReader(patch.toString())).readArray());
    String serverJson = NON_NULL_MAPPER.writeValueAsString(serverStoredEntity);
    String patchedJson =
        jsonPatch.apply(Json.createReader(new StringReader(serverJson)).readObject()).toString();
    return NON_NULL_MAPPER.readTree(patchedJson);
  }

  private static List<String> tagFqnsOf(JsonNode entity) {
    List<String> fqns = new ArrayList<>();
    JsonNode tags = entity.path("tags");
    if (tags.isArray()) {
      for (JsonNode tag : tags) {
        fqns.add(tag.path("tagFQN").asText());
      }
    }
    return fqns;
  }
}
