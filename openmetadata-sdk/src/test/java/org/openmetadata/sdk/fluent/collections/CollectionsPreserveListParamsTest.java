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
package org.openmetadata.sdk.fluent.collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.AllModels;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.services.dataassets.PipelineService;
import org.openmetadata.sdk.services.dataassets.TopicService;

/**
 * Regression tests for the auto-paginating {@code *Collection} classes in {@code
 * org.openmetadata.sdk.fluent.collections}.
 *
 * <p>Background: every {@code *Collection.loadNextPage()} (and the {@code nextPage()} delegation
 * variant used by some group-1 collections) historically built a brand-new {@link ListParams} per
 * page request and hand-copied only a subset of fields:
 *
 * <ul>
 *   <li>group 1 ({@link PipelineCollection}, {@code TableCollection}, {@code DatabaseCollection},
 *       {@code DatabaseSchemaCollection}, {@code GlossaryCollection}, {@code
 *       GlossaryTermCollection}, {@code TeamCollection}, {@code UserCollection}) copied only
 *       {@code limit}/{@code fields}/{@code after};
 *   <li>group 2 ({@link TopicCollection} and the remaining siblings) copied only {@code limit}
 *       plus the server page token, additionally dropping {@code fields} and the user's own start
 *       cursor ({@code after}).
 * </ul>
 *
 * <p>Every other user-supplied server-side filter ({@code addFilter}, {@code addQueryParam},
 * {@code setService}, {@code setDomain}, {@code setLatest}, {@code setOffset}, {@code setBefore},
 * ...) was silently discarded before the request was sent, so a filtered listing returned the full
 * unfiltered result set with no error, no warning, and no way to detect it from the returned data.
 *
 * <p>The fix preserves all params across pages by deep-copying the constructor's {@link ListParams}
 * via {@link ListParams#copy()} and only overriding the per-page {@code after} cursor from the
 * server's next-page token — the same pattern already used by {@code fluent/request/ListRequest}
 * for its paginated iterable.
 *
 * <p>These tests pin the contract that, for a group-1 collection ({@link PipelineCollection}) and a
 * group-2 collection ({@link TopicCollection}):
 *
 * <ol>
 *   <li>all constructor {@link ListParams} state — filters, queryParams, {@code latest}, {@code
 *       offset}, {@code before}, {@code fields}, {@code limit} and the user's own {@code after}
 *       start cursor — reaches the very first page request,
 *   <li>filters and all non-cursor params persist onto every subsequent page request,
 *   <li>the per-page {@code after} cursor is overridden by the server's next-page token on pages
 *       after the first, while the user's original {@link ListParams} instance is left unmutated,
 *   <li>group 2 collections now forward {@code fields} and the user's start cursor (previously
 *       dropped), and
 *   <li>the no-arg constructor still issues an empty-params request carrying no spurious filters.
 * </ol>
 *
 * <p>Tests mock the entity service at the {@code list(ListParams)} boundary and capture the exact
 * {@link ListParams} handed to it, so they assert what would actually be serialized onto the HTTP
 * query string (via {@link ListParams#toQueryParams()}).
 */
class CollectionsPreserveListParamsTest {

  private OpenMetadataClient client;
  private PipelineService pipelineService;
  private TopicService topicService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    client = mock(OpenMetadataClient.class);
    pipelineService = mock(PipelineService.class);
    topicService = mock(TopicService.class);
    when(client.pipelines()).thenReturn(pipelineService);
    when(client.topics()).thenReturn(topicService);
  }

  // ==================== Group 1: PipelineCollection ====================

  @Test
  void pipelineCollection_forwardsAllFiltersAndCursorsOnFirstPage() {
    ListParams params =
        new ListParams()
            .setLimit(10)
            .setFields("owner")
            .setBefore("before-cursor")
            .setOffset(5)
            .setLatest(true)
            .setAfter("user-start")
            .addFilter("serviceType", "Airflow")
            .addFilter("service", "airflow_service")
            .addQueryParam("include", "non-deleted");

    when(pipelineService.list(any(ListParams.class)))
        .thenReturn(pipelineResponse(Arrays.asList(new Pipeline().withName("p1")), null));

    new PipelineCollection(client, params).getCurrentPage();

    ListParams sent = capturePipelineList(1).get(0);
    // Direct field assertions (the bug report's failing assertion was
    // getFilters().get("serviceType")).
    assertEquals("Airflow", sent.getFilters().get("serviceType"));
    assertEquals("airflow_service", sent.getFilters().get("service"));
    assertEquals(10, sent.getLimit());
    assertEquals("owner", sent.getFields());
    assertEquals("before-cursor", sent.getBefore());
    assertEquals(5, sent.getOffset());
    assertEquals(Boolean.TRUE, sent.getLatest());
    // The user's own start cursor must survive onto page 1 (group 1 fallback behavior preserved).
    assertEquals("user-start", sent.getAfter());
    // Wire-faithful: exactly the query string the HTTP layer would serialize.
    Map<String, String> qp = sent.toQueryParams();
    assertEquals("10", qp.get("limit"));
    assertEquals("owner", qp.get("fields"));
    assertEquals("before-cursor", qp.get("before"));
    assertEquals("5", qp.get("offset"));
    assertEquals("true", qp.get("latest"));
    assertEquals("user-start", qp.get("after"));
    assertEquals("Airflow", qp.get("serviceType"));
    assertEquals("airflow_service", qp.get("service"));
    assertEquals("non-deleted", qp.get("include"));
  }

  @Test
  void pipelineCollection_paginate_preservesFiltersAcrossPagesAndOverridesCursor() {
    ListParams params =
        new ListParams()
            .setLimit(10)
            .setFields("owner")
            .setAfter("user-start")
            .addFilter("serviceType", "Airflow")
            .addQueryParam("include", "non-deleted")
            .setLatest(true)
            .setOffset(5);

    when(pipelineService.list(any(ListParams.class)))
        .thenReturn(
            pipelineResponse(Arrays.asList(new Pipeline().withName("p1")), "server-cursor-1"),
            pipelineResponse(Arrays.asList(new Pipeline().withName("p2")), null));

    PipelineCollection collection = new PipelineCollection(client, params).autoPaginate();
    // Drain the auto-paginating iterator to force both pages to be fetched.
    for (Pipeline ignored : collection) {}

    List<ListParams> sent = capturePipelineList(2);
    ListParams first = sent.get(0);
    ListParams second = sent.get(1);

    // Page 1: user's start cursor is preserved; filters/params all forwarded.
    assertEquals("user-start", first.getAfter());
    assertEquals("Airflow", first.getFilters().get("serviceType"));
    assertEquals("non-deleted", first.toQueryParams().get("include"));
    assertEquals("owner", first.getFields());
    assertEquals(10, first.getLimit());

    // Page 2: the server's next-page token overrides the cursor, but every filter/param persists.
    assertEquals("server-cursor-1", second.getAfter());
    assertEquals("Airflow", second.getFilters().get("serviceType"));
    assertEquals("non-deleted", second.toQueryParams().get("include"));
    assertEquals("owner", second.getFields());
    assertEquals(10, second.getLimit());
    assertEquals(5, second.getOffset());
    assertEquals(Boolean.TRUE, second.getLatest());

    // The user's original ListParams instance must not be mutated by pagination (we deep-copy).
    assertEquals("user-start", params.getAfter());
    assertEquals("Airflow", params.getFilters().get("serviceType"));
  }

  @Test
  void pipelineCollection_noArgConstructor_sendsEmptyParamsWithNoSpuriousFilters() {
    when(pipelineService.list(any(ListParams.class)))
        .thenReturn(pipelineResponse(Arrays.asList(new Pipeline().withName("p1")), null));

    new PipelineCollection(client).getCurrentPage();

    ListParams sent = capturePipelineList(1).get(0);
    assertTrue(sent.getFilters().isEmpty(), "no-arg constructor must not add spurious filters");
    assertEquals(null, sent.getAfter());
    assertEquals(null, sent.getBefore());
    assertEquals(null, sent.getFields());
    assertEquals(null, sent.getOffset());
    assertEquals(null, sent.getLatest());
  }

  @Test
  void pipelineCollection_resetsAndRefetchesFirstPageWithFiltersIntact() {
    ListParams params =
        new ListParams().setLimit(7).setFields("owner").addFilter("serviceType", "Airflow");

    when(pipelineService.list(any(ListParams.class)))
        .thenReturn(
            pipelineResponse(Arrays.asList(new Pipeline().withName("p1")), "server-cursor-1"),
            pipelineResponse(Arrays.asList(new Pipeline().withName("p2")), null),
            pipelineResponse(
                Arrays.asList(new Pipeline().withName("p1-again")), "server-cursor-1"));

    PipelineCollection collection = new PipelineCollection(client, params);
    collection.getCurrentPage();
    collection.loadNextPage();
    collection.reset(); // drop state, must re-request page 1 with the user cursor again
    collection.getCurrentPage();

    List<ListParams> sent = capturePipelineList(3);
    // After reset, the first-page request must carry the user's original params (no cursor leak).
    assertEquals(null, sent.get(0).getAfter());
    assertEquals("server-cursor-1", sent.get(1).getAfter());
    assertEquals(null, sent.get(2).getAfter());
    for (ListParams page : sent) {
      assertEquals("Airflow", page.getFilters().get("serviceType"));
      assertEquals("owner", page.getFields());
      assertEquals(7, page.getLimit());
    }
  }

  @Test
  void pipelineCollection_beforeOnlyStartClearsBeforeWhenPagingAfterServerCursor() {
    // A caller that starts iteration with only `before` (no `after`) must not still send `before`
    // once the server hands back an `after` token: the server rejects a request carrying both
    // cursors with HTTP 400, so the second page would never load. `loadNextPage()` copies the
    // constructor params (keeping `before`) and then overrides `after` from the server token, so it
    // must clear `before` on the same request to avoid the dual-cursor rejection.
    ListParams params =
        new ListParams()
            .setLimit(7)
            .setFields("owner")
            .setBefore("user-before")
            .addFilter("serviceType", "Airflow");

    when(pipelineService.list(any(ListParams.class)))
        .thenReturn(
            pipelineResponse(Arrays.asList(new Pipeline().withName("p1")), "server-cursor-1"),
            pipelineResponse(Arrays.asList(new Pipeline().withName("p2")), null));

    PipelineCollection collection = new PipelineCollection(client, params);
    collection.getCurrentPage();
    collection.loadNextPage();

    List<ListParams> sent = capturePipelineList(2);
    // First page keeps the user's `before` cursor and every filter/param.
    assertEquals("user-before", sent.get(0).getBefore());
    assertEquals(null, sent.get(0).getAfter());
    assertEquals("Airflow", sent.get(0).getFilters().get("serviceType"));
    assertEquals("owner", sent.get(0).getFields());
    assertEquals(7, sent.get(0).getLimit());
    // Second page switches to the server's `after` token and drops `before` to avoid the 400.
    assertEquals("server-cursor-1", sent.get(1).getAfter());
    assertEquals(null, sent.get(1).getBefore());
    assertEquals("Airflow", sent.get(1).getFilters().get("serviceType"));
    assertEquals("owner", sent.get(1).getFields());
    assertEquals(7, sent.get(1).getLimit());
  }

  // ==================== Group 2: TopicCollection ====================

  @Test
  void topicCollection_nowPreservesFieldsFiltersUserCursorAndLatest() {
    // Group 2 previously dropped fields, the user's `after` start cursor, latest, offset and
    // before — copying only limit + the server page token. They must all now be forwarded.
    ListParams params =
        new ListParams()
            .setLimit(20)
            .setFields("owner")
            .setAfter("user-start")
            .setBefore("before-cursor")
            .setOffset(3)
            .setLatest(true)
            .addFilter("serviceType", "Kafka")
            .addQueryParam("include", "non-deleted");

    when(topicService.list(any(ListParams.class)))
        .thenReturn(topicResponse(Arrays.asList(new Topic().withName("t1")), null));

    new TopicCollection(client, params).getCurrentPage();

    ListParams sent = captureTopicList(1).get(0);
    assertEquals(20, sent.getLimit());
    assertEquals("owner", sent.getFields());
    assertEquals("user-start", sent.getAfter());
    assertEquals("before-cursor", sent.getBefore());
    assertEquals(3, sent.getOffset());
    assertEquals(Boolean.TRUE, sent.getLatest());
    assertEquals("Kafka", sent.getFilters().get("serviceType"));
    Map<String, String> qp = sent.toQueryParams();
    assertEquals("non-deleted", qp.get("include"));
    assertEquals("owner", qp.get("fields"));
    assertEquals("user-start", qp.get("after"));
    assertEquals("true", qp.get("latest"));
    assertEquals("Kafka", qp.get("serviceType"));
  }

  @Test
  void topicCollection_paginate_preservesFiltersAcrossPagesAndOverridesCursor() {
    ListParams params =
        new ListParams()
            .setLimit(15)
            .setFields("owner")
            .setAfter("user-start")
            .addFilter("serviceType", "Kafka")
            .addQueryParam("include", "non-deleted");

    when(topicService.list(any(ListParams.class)))
        .thenReturn(
            topicResponse(Arrays.asList(new Topic().withName("t1")), "server-cursor-1"),
            topicResponse(Arrays.asList(new Topic().withName("t2")), null));

    // TopicCollection.toList() walks pages via getCurrentPage()/loadNextPage().
    List<Topic> all = new TopicCollection(client, params).toList();

    assertEquals(2, all.size());
    assertEquals("t1", all.get(0).getName());
    assertEquals("t2", all.get(1).getName());

    List<ListParams> sent = captureTopicList(2);
    ListParams first = sent.get(0);
    ListParams second = sent.get(1);

    // Page 1: user's start cursor preserved; filters/fields forwarded (group 2 used to drop these).
    assertEquals("user-start", first.getAfter());
    assertEquals("owner", first.getFields());
    assertEquals("Kafka", first.getFilters().get("serviceType"));
    assertEquals("non-deleted", first.toQueryParams().get("include"));
    assertEquals(15, first.getLimit());

    // Page 2: server cursor overrides, filters/fields/limit persist.
    assertEquals("server-cursor-1", second.getAfter());
    assertEquals("owner", second.getFields());
    assertEquals("Kafka", second.getFilters().get("serviceType"));
    assertEquals("non-deleted", second.toQueryParams().get("include"));
    assertEquals(15, second.getLimit());

    // Original params unmutated.
    assertEquals("user-start", params.getAfter());
    assertEquals("Kafka", params.getFilters().get("serviceType"));
  }

  @Test
  void topicCollection_noArgConstructor_sendsEmptyParamsWithNoSpuriousFilters() {
    when(topicService.list(any(ListParams.class)))
        .thenReturn(topicResponse(Arrays.asList(new Topic().withName("t1")), null));

    new TopicCollection(client).getCurrentPage();

    ListParams sent = captureTopicList(1).get(0);
    assertTrue(sent.getFilters().isEmpty(), "no-arg constructor must not add spurious filters");
    assertFalse(sent.toQueryParams().containsKey("fields"));
    assertFalse(sent.toQueryParams().containsKey("latest"));
  }

  // ==================== helpers ====================

  private List<ListParams> capturePipelineList(int expectedCalls) {
    ArgumentCaptor<ListParams> captor = ArgumentCaptor.forClass(ListParams.class);
    verify(pipelineService, times(expectedCalls)).list(captor.capture());
    return captor.getAllValues();
  }

  private List<ListParams> captureTopicList(int expectedCalls) {
    ArgumentCaptor<ListParams> captor = ArgumentCaptor.forClass(ListParams.class);
    verify(topicService, times(expectedCalls)).list(captor.capture());
    return captor.getAllValues();
  }

  private static ListResponse<Pipeline> pipelineResponse(List<Pipeline> data, String afterCursor) {
    return afterCursor == null
        ? new ListResponse<>(data)
        : new ListResponse<>(data, new AllModels.Paging().withAfter(afterCursor));
  }

  private static ListResponse<Topic> topicResponse(List<Topic> data, String afterCursor) {
    return afterCursor == null
        ? new ListResponse<>(data)
        : new ListResponse<>(data, new AllModels.Paging().withAfter(afterCursor));
  }
}
