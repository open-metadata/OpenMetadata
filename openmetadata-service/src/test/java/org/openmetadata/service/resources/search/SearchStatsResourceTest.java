/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.resources.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.search.SearchStatsResponse;
import org.openmetadata.schema.api.search.SearchStatsResponse$IndexStats;
import org.openmetadata.schema.api.search.SearchStatsResponse$OrphanIndex;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.IndexManagementClient.IndexStats;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchHealthStatus;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;

/**
 * Unit tests for {@link SearchResource#getSearchStats}. These guard the int64 contract: the byte
 * and document count fields are declared {@code format: int64} in {@code searchStats.json} and must
 * be emitted as full 64-bit values that agree with their sibling {@code *Formatted} strings. A
 * previous version narrowed the underlying {@code long} values to {@code Integer} via explicit
 * {@code (int)} casts, which wrapped values above 2^31-1 (and to negative numbers above 2^31) and
 * made the numeric fields contradict the {@code *Formatted} fields in the same response body.
 */
class SearchStatsResourceTest {

  private Authorizer mockAuthorizer;
  private SecurityContext mockSecurityContext;
  private SearchRepository mockSearchRepository;
  private SearchClient mockSearchClient;
  private CollectionDAO mockCollectionDAO;
  private CollectionDAO.SearchIndexJobDAO mockSearchIndexJobDAO;

  // Index sizes are exact GiB multiples so the expected sizeFormatted strings are deterministic.
  private static final long SIZE_12_GIB = 12L * 1024 * 1024 * 1024; // 12_884_901_888L
  private static final long SIZE_4_GIB = 4L * 1024 * 1024 * 1024; // 4_294_967_296L
  private static final long SIZE_8_GIB = 8L * 1024 * 1024 * 1024; // 8_589_934_592L
  private static final long TOTAL_SIZE = SIZE_12_GIB + SIZE_4_GIB + SIZE_8_GIB; // 24 GiB

  private static final long DOCS_INDEX_1 = 3_500_000_000L; // > 2^31-1 -> wraps negative as int
  private static final long DOCS_INDEX_2 = 2_500_000_000L; // > 2^31-1 -> wraps negative as int
  private static final long DOCS_REBUILD = 2_200_000_000L; // > 2^31-1 -> wraps negative as int
  private static final long TOTAL_DOCS = DOCS_INDEX_1 + DOCS_INDEX_2 + DOCS_REBUILD; // 8.2B

  private static final String REGULAR_INDEX_1 = "table_search_index";
  private static final String REGULAR_INDEX_2 = "user_search_index";
  private static final String REBUILD_INDEX = "table_search_index_rebuild_123";

  @BeforeEach
  void setUp() {
    mockAuthorizer = mock(Authorizer.class);
    mockSecurityContext = mock(SecurityContext.class);
    mockSearchRepository = mock(SearchRepository.class);
    mockSearchClient = mock(SearchClient.class);
    mockCollectionDAO = mock(CollectionDAO.class);
    mockSearchIndexJobDAO = mock(CollectionDAO.SearchIndexJobDAO.class);
  }

  private SearchStatsResponse invokeGetSearchStats() throws Exception {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      // SearchResource constructor reads Entity.getSearchRepository(); keep them aligned so the
      // resource holds the same mock repository used for stubbing below.
      entityMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepository);
      entityMock.when(Entity::getCollectionDAO).thenReturn(mockCollectionDAO);

      SearchResource resource = new SearchResource(mockAuthorizer);

      when(mockSearchRepository.getSearchClient()).thenReturn(mockSearchClient);
      when(mockSearchRepository.getEntityIndexMap()).thenReturn(java.util.Map.of());

      when(mockSearchClient.getAllIndexStats())
          .thenReturn(
              List.of(
                  new IndexStats(
                      REGULAR_INDEX_1,
                      DOCS_INDEX_1,
                      0L,
                      1,
                      1,
                      SIZE_12_GIB,
                      "green",
                      Set.of("table")),
                  new IndexStats(
                      REGULAR_INDEX_2, DOCS_INDEX_2, 0L, 1, 1, SIZE_4_GIB, "green", Set.of("user")),
                  new IndexStats(
                      REBUILD_INDEX, DOCS_REBUILD, 0L, 1, 1, SIZE_8_GIB, "yellow", Set.of())));
      when(mockSearchClient.getSearchHealthStatus()).thenReturn(new SearchHealthStatus("healthy"));
      // List the rebuild index so the orphan path is exercised; its aliases are empty, so it IS
      // an orphan.
      when(mockSearchClient.listIndicesByPrefix(""))
          .thenReturn(Set.of(REGULAR_INDEX_1, REGULAR_INDEX_2, REBUILD_INDEX));
      when(mockSearchClient.getAliases(REBUILD_INDEX)).thenReturn(Set.of());
      // No distributed search indexing job running.
      when(mockCollectionDAO.searchIndexJobDAO()).thenReturn(mockSearchIndexJobDAO);
      when(mockSearchIndexJobDAO.findByStatuses(org.mockito.ArgumentMatchers.<List<String>>any()))
          .thenReturn(List.of());

      Response response = resource.getSearchStats(mockSecurityContext);
      assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
      assertNotNull(response.getEntity());
      return (SearchStatsResponse) response.getEntity();
    }
  }

  /** Reflection guard: the schema's int64 fields must generate {@code Long}, not {@code Integer}. */
  @Test
  void generatedPojoUsesLongForInt64Fields() throws Exception {
    assertEquals(
        Long.class, SearchStatsResponse.class.getDeclaredField("totalDocuments").getType());
    assertEquals(
        Long.class, SearchStatsResponse.class.getDeclaredField("totalSizeInBytes").getType());
    assertEquals(
        Long.class, SearchStatsResponse$IndexStats.class.getDeclaredField("documents").getType());
    assertEquals(
        Long.class, SearchStatsResponse$IndexStats.class.getDeclaredField("sizeInBytes").getType());
    assertEquals(
        Long.class,
        SearchStatsResponse$OrphanIndex.class.getDeclaredField("sizeInBytes").getType());
  }

  /**
   * The headline regression: every int64 byte/document count must be emitted as the full long value,
   * never wrapped/truncated, and the numeric fields must agree with their sibling {@code
   * *Formatted} strings.
   */
  @Test
  void getSearchStatsPreservesInt64ValuesAboveInt32Range() throws Exception {
    SearchStatsResponse response = invokeGetSearchStats();

    // Cluster-wide aggregates: must equal the true long sums, not the int-cast wrapped values.
    assertEquals(Long.valueOf(TOTAL_DOCS), response.getTotalDocuments());
    assertEquals(Long.valueOf(TOTAL_SIZE), response.getTotalSizeInBytes());
    // Sanity: the fix prevents the negative-wrap the old (int) cast produced.
    assertTrue(response.getTotalDocuments() > 0, "totalDocuments must not wrap to negative");
    assertTrue(response.getTotalSizeInBytes() > 0, "totalSizeInBytes must not wrap to negative");

    // The numeric field and the formatted string describe the same quantity and must agree.
    assertEquals("24.00 GB", response.getTotalSizeFormatted());
    assertEquals(
        TOTAL_SIZE,
        response.getTotalSizeInBytes().longValue(),
        "numeric bytes must match the formatted GB");
  }

  /** Per-index {@code documents}/{@code sizeInBytes} must retain full long fidelity. */
  @Test
  void getSearchStatsPreservesPerIndexInt64Values() throws Exception {
    SearchStatsResponse response = invokeGetSearchStats();

    List<SearchStatsResponse$IndexStats> indexes = response.getIndexes();
    assertEquals(3, indexes.size());

    SearchStatsResponse$IndexStats regular1 = byName(indexes, REGULAR_INDEX_1);
    assertEquals(Long.valueOf(DOCS_INDEX_1), regular1.getDocuments());
    assertEquals(Long.valueOf(SIZE_12_GIB), regular1.getSizeInBytes());
    assertEquals("12.00 GB", regular1.getSizeFormatted());

    SearchStatsResponse$IndexStats regular2 = byName(indexes, REGULAR_INDEX_2);
    assertEquals(Long.valueOf(DOCS_INDEX_2), regular2.getDocuments());
    assertEquals(Long.valueOf(SIZE_4_GIB), regular2.getSizeInBytes());
    assertEquals("4.00 GB", regular2.getSizeFormatted());
  }

  /** The orphan index's {@code sizeInBytes} must be the looked-up full long, not int-cast. */
  @Test
  void getSearchStatsPreservesOrphanIndexInt64Size() throws Exception {
    SearchStatsResponse response = invokeGetSearchStats();

    List<SearchStatsResponse$OrphanIndex> orphans = response.getOrphanIndexes();
    assertEquals(1, orphans.size());
    SearchStatsResponse$OrphanIndex orphan = orphans.get(0);
    assertEquals(REBUILD_INDEX, orphan.getName());
    assertEquals(Long.valueOf(SIZE_8_GIB), orphan.getSizeInBytes());
    assertEquals("8.00 GB", orphan.getSizeFormatted());
    assertTrue(orphan.getSizeInBytes() > 0, "orphan sizeInBytes must not wrap to negative");
  }

  /**
   * The on-the-wire JSON must carry the full long values (this is the contract callers see). This
   * catches a regression where the POJO type is correct but a narrowing cast is re-introduced.
   */
  @Test
  void getSearchStatsSerializesFullInt64ValuesOnTheWire() throws Exception {
    SearchStatsResponse response = invokeGetSearchStats();
    String json = JsonUtils.pojoToJson(response);
    JsonNode root = JsonUtils.readTree(json);

    assertEquals(TOTAL_DOCS, root.get("totalDocuments").asLong());
    assertEquals(TOTAL_SIZE, root.get("totalSizeInBytes").asLong());
    assertEquals("24.00 GB", root.get("totalSizeFormatted").asText());

    // Orphan index size is the full long in the serialized body.
    JsonNode orphan = root.get("orphanIndexes").get(0);
    assertEquals(SIZE_8_GIB, orphan.get("sizeInBytes").asLong());
    assertEquals("8.00 GB", orphan.get("sizeFormatted").asText());

    // At least one per-index entry carries its full 12 GiB size that would wrap to 0 as an int.
    JsonNode indexes = root.get("indexes");
    boolean found12Gib = false;
    for (JsonNode idx : indexes) {
      if (REGULAR_INDEX_1.equals(idx.get("name").asText())) {
        assertEquals(SIZE_12_GIB, idx.get("sizeInBytes").asLong());
        assertEquals(DOCS_INDEX_1, idx.get("documents").asLong());
        found12Gib = true;
      }
    }
    assertTrue(found12Gib, "regular index 1 must be present in the serialized body");
  }

  /** The aggregate {@code totalSizeInBytes} must equal the sum of per-index sizes. */
  @Test
  void getSearchStatsTotalSizeAggregatesAcrossIndexes() throws Exception {
    SearchStatsResponse response = invokeGetSearchStats();
    long sumOfIndexSizes = response.getIndexes().stream().mapToLong(i -> i.getSizeInBytes()).sum();
    assertEquals(
        response.getTotalSizeInBytes().longValue(),
        sumOfIndexSizes,
        "totalSizeInBytes must equal the sum of per-index sizes");
    long sumOfIndexDocs = response.getIndexes().stream().mapToLong(i -> i.getDocuments()).sum();
    assertEquals(
        response.getTotalDocuments().longValue(),
        sumOfIndexDocs,
        "totalDocuments must equal the sum of per-index documents");
  }

  /** The admin/bot authorization gate is enforced before any search work runs. */
  @Test
  void getSearchStatsRequiresAdminOrBot() {
    doThrow(new AuthorizationException("Forbidden"))
        .when(mockAuthorizer)
        .authorizeAdminOrBot(mockSecurityContext);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepository);
      SearchResource resource = new SearchResource(mockAuthorizer);

      assertThrows(
          AuthorizationException.class, () -> resource.getSearchStats(mockSecurityContext));
    }
  }

  /** Response metadata populated from the search client must still be correct. */
  @Test
  void getSearchStatsPopulatesClusterMetadata() throws Exception {
    SearchStatsResponse response = invokeGetSearchStats();
    assertEquals("GREEN", response.getClusterHealth());
    assertEquals(Integer.valueOf(3), response.getTotalIndexes());
    assertEquals(Integer.valueOf(3), response.getTotalPrimaryShards());
    assertEquals(Integer.valueOf(3), response.getTotalReplicaShards());
    assertEquals(Integer.valueOf(0), response.getExpectedIndexCount());
    assertNotNull(response.getMissingIndexes());
    assertTrue(response.getMissingIndexes().isEmpty());
    // No quartz/distributed indexing job is running in this mocked environment.
    assertFalse(response.getIsSearchIndexingRunning());
  }

  private static SearchStatsResponse$IndexStats byName(
      List<SearchStatsResponse$IndexStats> indexes, String name) {
    return indexes.stream()
        .filter(i -> name.equals(i.getName()))
        .findFirst()
        .orElseThrow(() -> new AssertionError("missing index " + name));
  }
}
