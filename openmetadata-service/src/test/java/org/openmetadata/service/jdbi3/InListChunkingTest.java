/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.CollectionDAO.DataQualityDataTimeSeriesDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.CollectionDAO.TagUsageDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.TestCaseResultTimeSeriesDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.UsageDAO;

/**
 * Outcome tests for the IN-list chunking that keeps bulk delete / restore queries under the
 * database prepared-statement parameter ceiling (PostgreSQL hard-caps at 65,535 bound params).
 *
 * <p>These do not verify how many times the delegate is called — they assert the observable
 * contract of the partition: every chunk stays within {@link EntityDAO#MAX_IN_LIST_CHUNK_SIZE},
 * the union of chunks equals the input exactly once each (no dropped or duplicated ids), and the
 * aggregated result equals the concatenation of the per-chunk results.
 */
class InListChunkingTest {

  private static final int OVER_LIMIT = EntityDAO.MAX_IN_LIST_CHUNK_SIZE * 2 + 2;

  private static List<String> ids(int count) {
    return IntStream.range(0, count)
        .mapToObj(i -> new UUID(0L, i).toString())
        .collect(Collectors.toList());
  }

  private static List<UUID> uuids(int count) {
    return IntStream.range(0, count).mapToObj(i -> new UUID(0L, i)).collect(Collectors.toList());
  }

  private static void assertChunksWithinLimit(List<List<String>> chunks) {
    assertTrue(
        chunks.stream().allMatch(chunk -> chunk.size() <= EntityDAO.MAX_IN_LIST_CHUNK_SIZE),
        "every chunk must stay within MAX_IN_LIST_CHUNK_SIZE");
  }

  private static void assertCoversInputExactlyOnce(List<String> input, List<List<String>> chunks) {
    List<String> flattened = chunks.stream().flatMap(List::stream).collect(Collectors.toList());
    assertEquals(input, flattened, "union of chunks must equal the input exactly once, in order");
  }

  @Test
  void findToBatchAllTypes_chunksOverLimitAndAggregates() {
    EntityRelationshipDAO dao = mock(EntityRelationshipDAO.class, CALLS_REAL_METHODS);
    List<List<String>> chunks = new ArrayList<>();
    when(dao.findToBatchAllTypesWithCondition(anyList(), anyInt(), anyString()))
        .thenAnswer(
            invocation -> {
              List<String> chunk = invocation.getArgument(0);
              chunks.add(List.copyOf(chunk));
              return chunk.stream()
                  .map(id -> EntityRelationshipObject.builder().fromId(id).build())
                  .collect(Collectors.toList());
            });

    List<String> input = ids(OVER_LIMIT);
    List<EntityRelationshipObject> result = dao.findToBatchAllTypes(input, 1, Include.ALL);

    assertChunksWithinLimit(chunks);
    assertCoversInputExactlyOnce(input, chunks);
    assertEquals(
        input,
        result.stream().map(EntityRelationshipObject::getFromId).collect(Collectors.toList()),
        "aggregated result must equal the concatenation of per-chunk results");
  }

  @Test
  void findFromBatch_chunksOverLimitAndAggregates() {
    EntityRelationshipDAO dao = mock(EntityRelationshipDAO.class, CALLS_REAL_METHODS);
    List<List<String>> chunks = new ArrayList<>();
    when(dao.findFromBatchWithCondition(anyList(), anyInt(), anyString()))
        .thenAnswer(
            invocation -> {
              List<String> chunk = invocation.getArgument(0);
              chunks.add(List.copyOf(chunk));
              return chunk.stream()
                  .map(id -> EntityRelationshipObject.builder().toId(id).build())
                  .collect(Collectors.toList());
            });

    List<String> input = ids(OVER_LIMIT);
    List<EntityRelationshipObject> result = dao.findFromBatch(input, 1, Include.ALL);

    assertChunksWithinLimit(chunks);
    assertCoversInputExactlyOnce(input, chunks);
    assertEquals(
        input, result.stream().map(EntityRelationshipObject::getToId).collect(Collectors.toList()));
  }

  @Test
  void deleteAllBatch_chunksOverLimit() {
    EntityExtensionDAO dao = mock(EntityExtensionDAO.class, CALLS_REAL_METHODS);
    List<List<String>> chunks = new ArrayList<>();
    doAnswer(
            invocation -> {
              chunks.add(List.copyOf(invocation.getArgument(0)));
              return null;
            })
        .when(dao)
        .deleteAllBatchInternal(anyList());

    List<String> input = ids(OVER_LIMIT);
    dao.deleteAllBatch(input);

    assertChunksWithinLimit(chunks);
    assertCoversInputExactlyOnce(input, chunks);
  }

  @Test
  void getTagsInternalBatch_chunksOverLimit() {
    TagUsageDAO dao = mock(TagUsageDAO.class, CALLS_REAL_METHODS);
    List<List<String>> chunks = new ArrayList<>();
    when(dao.getTagsInternalBatchInternal(anyList()))
        .thenAnswer(
            invocation -> {
              chunks.add(List.copyOf(invocation.getArgument(0)));
              return new ArrayList<>();
            });

    List<String> input = ids(OVER_LIMIT);
    dao.getTagsInternalBatch(input);

    assertChunksWithinLimit(chunks);
    assertCoversInputExactlyOnce(input, chunks);
  }

  @Test
  void queryInChunks_deduplicatesIdsSplitAcrossChunks() {
    EntityRelationshipDAO dao = mock(EntityRelationshipDAO.class, CALLS_REAL_METHODS);
    List<List<String>> chunks = new ArrayList<>();
    when(dao.findToBatchAllTypesWithCondition(anyList(), anyInt(), anyString()))
        .thenAnswer(
            invocation -> {
              List<String> chunk = invocation.getArgument(0);
              chunks.add(List.copyOf(chunk));
              return chunk.stream()
                  .map(id -> EntityRelationshipObject.builder().fromId(id).build())
                  .collect(Collectors.toList());
            });

    List<String> distinct = ids(OVER_LIMIT);
    List<String> withDuplicates = new ArrayList<>(distinct);
    withDuplicates.addAll(distinct.subList(0, 10));

    List<EntityRelationshipObject> result = dao.findToBatchAllTypes(withDuplicates, 1, Include.ALL);

    assertChunksWithinLimit(chunks);
    assertCoversInputExactlyOnce(distinct, chunks);
    assertEquals(
        distinct,
        result.stream().map(EntityRelationshipObject::getFromId).collect(Collectors.toList()),
        "duplicate ids split across chunks must not produce duplicate result rows");
  }

  @Test
  void updateInChunks_deduplicatesIdsSplitAcrossChunks() {
    EntityExtensionDAO dao = mock(EntityExtensionDAO.class, CALLS_REAL_METHODS);
    List<List<String>> chunks = new ArrayList<>();
    doAnswer(
            invocation -> {
              chunks.add(List.copyOf(invocation.getArgument(0)));
              return null;
            })
        .when(dao)
        .deleteAllBatchInternal(anyList());

    List<String> distinct = ids(OVER_LIMIT);
    List<String> withDuplicates = new ArrayList<>(distinct);
    withDuplicates.addAll(distinct.subList(0, 10));

    dao.deleteAllBatch(withDuplicates);

    assertChunksWithinLimit(chunks);
    assertCoversInputExactlyOnce(distinct, chunks);
  }

  @Test
  void queryInChunks_atOrBelowLimitPassesDuplicatesThroughVerbatim() {
    EntityRelationshipDAO dao = mock(EntityRelationshipDAO.class, CALLS_REAL_METHODS);
    List<List<String>> chunks = new ArrayList<>();
    when(dao.findToBatchAllTypesWithCondition(anyList(), anyInt(), anyString()))
        .thenAnswer(
            invocation -> {
              List<String> chunk = invocation.getArgument(0);
              chunks.add(List.copyOf(chunk));
              return chunk.stream()
                  .map(id -> EntityRelationshipObject.builder().fromId(id).build())
                  .collect(Collectors.toList());
            });

    List<String> withDuplicates = new ArrayList<>(ids(5));
    withDuplicates.addAll(ids(5).subList(0, 2));

    List<EntityRelationshipObject> result = dao.findToBatchAllTypes(withDuplicates, 1, Include.ALL);

    assertEquals(1, chunks.size(), "a list within the limit must issue exactly one query");
    assertCoversInputExactlyOnce(withDuplicates, chunks);
    assertEquals(
        withDuplicates,
        result.stream().map(EntityRelationshipObject::getFromId).collect(Collectors.toList()),
        "within the limit the list is passed through verbatim — duplicates are NOT stripped here; "
            + "collapsing them is the database's job via IN(...) set semantics");
  }

  @Test
  void updateInChunks_atOrBelowLimitPassesDuplicatesThroughVerbatim() {
    EntityExtensionDAO dao = mock(EntityExtensionDAO.class, CALLS_REAL_METHODS);
    List<List<String>> chunks = new ArrayList<>();
    doAnswer(
            invocation -> {
              chunks.add(List.copyOf(invocation.getArgument(0)));
              return null;
            })
        .when(dao)
        .deleteAllBatchInternal(anyList());

    List<String> withDuplicates = new ArrayList<>(ids(5));
    withDuplicates.addAll(ids(5).subList(0, 2));

    dao.deleteAllBatch(withDuplicates);

    assertEquals(1, chunks.size(), "a list within the limit must issue exactly one statement");
    assertCoversInputExactlyOnce(withDuplicates, chunks);
  }

  @Test
  void bulkUpdateFromId_chunksOverLimit() {
    EntityRelationshipDAO dao = mock(EntityRelationshipDAO.class, CALLS_REAL_METHODS);
    List<List<String>> chunks = new ArrayList<>();
    doAnswer(
            invocation -> {
              chunks.add(List.copyOf(invocation.getArgument(2)));
              return null;
            })
        .when(dao)
        .bulkUpdateFromIdInternal(any(), any(), anyList(), anyString(), anyString(), anyInt());

    List<String> input = ids(OVER_LIMIT);
    dao.bulkUpdateFromId(new UUID(0L, 1L), new UUID(0L, 2L), input, "glossary", "glossaryTerm", 10);

    assertChunksWithinLimit(chunks);
    assertCoversInputExactlyOnce(input, chunks);
  }

  @Test
  void deleteTagsByTargets_chunksOverLimit() {
    TagUsageDAO dao = mock(TagUsageDAO.class, CALLS_REAL_METHODS);
    List<List<String>> chunks = new ArrayList<>();
    doAnswer(
            invocation -> {
              chunks.add(List.copyOf(invocation.getArgument(0)));
              return null;
            })
        .when(dao)
        .deleteTagsByTargetsInternal(anyList());

    List<String> input = ids(OVER_LIMIT);
    dao.deleteTagsByTargets(input);

    assertChunksWithinLimit(chunks);
    assertCoversInputExactlyOnce(input, chunks);
  }

  @Test
  void getLatestExtensionBatch_chunksOverLimitAndAggregates() {
    EntityTimeSeriesDAO dao = mock(EntityTimeSeriesDAO.class, CALLS_REAL_METHODS);
    List<List<String>> chunks = new ArrayList<>();
    when(dao.getLatestExtensionBatch(any(), anyList(), anyString()))
        .thenAnswer(
            invocation -> {
              List<String> chunk = invocation.getArgument(1);
              chunks.add(List.copyOf(chunk));
              return chunk.stream()
                  .map(h -> new EntityTimeSeriesDAO.FQNHashJsonRow(h, "{}"))
                  .collect(Collectors.toList());
            });

    List<String> input = ids(OVER_LIMIT);
    Map<String, String> result = dao.getLatestExtensionBatch(input, "someExtension");

    assertChunksWithinLimit(chunks);
    assertCoversInputExactlyOnce(input, chunks);
    assertEquals(
        input.size(), result.size(), "every distinct hash must appear in the aggregated map");
  }

  @Test
  void bulkRemoveToRelationship_chunksOverLimit() {
    EntityRelationshipDAO dao = mock(EntityRelationshipDAO.class, CALLS_REAL_METHODS);
    List<List<String>> chunks = new ArrayList<>();
    doAnswer(
            invocation -> {
              chunks.add(List.copyOf(invocation.getArgument(1)));
              return null;
            })
        .when(dao)
        .bulkRemoveTo(any(), anyList(), anyString(), anyString(), anyInt());

    List<UUID> input = uuids(OVER_LIMIT);
    dao.bulkRemoveToRelationship(new UUID(1L, 0L), input, "glossary", "glossaryTerm", 10);

    assertChunksWithinLimit(chunks);
    assertCoversInputExactlyOnce(
        input.stream().map(UUID::toString).collect(Collectors.toList()), chunks);
  }

  @Test
  void bulkRemoveFromRelationship_chunksOverLimit() {
    EntityRelationshipDAO dao = mock(EntityRelationshipDAO.class, CALLS_REAL_METHODS);
    List<List<String>> chunks = new ArrayList<>();
    doAnswer(
            invocation -> {
              chunks.add(List.copyOf(invocation.getArgument(0)));
              return null;
            })
        .when(dao)
        .bulkRemoveFrom(anyList(), any(), anyString(), anyString(), anyInt());

    List<UUID> input = uuids(OVER_LIMIT);
    dao.bulkRemoveFromRelationship(input, new UUID(1L, 0L), "glossary", "glossaryTerm", 10);

    assertChunksWithinLimit(chunks);
    assertCoversInputExactlyOnce(
        input.stream().map(UUID::toString).collect(Collectors.toList()), chunks);
  }

  @Test
  void getLatestUsageBatch_chunksOverLimit() {
    UsageDAO dao = mock(UsageDAO.class, CALLS_REAL_METHODS);
    List<List<String>> chunks = new ArrayList<>();
    when(dao.getLatestUsageBatchInternal(anyList()))
        .thenAnswer(
            invocation -> {
              chunks.add(List.copyOf(invocation.getArgument(0)));
              return new ArrayList<>();
            });

    List<String> input = ids(OVER_LIMIT);
    dao.getLatestUsageBatch(input);

    assertChunksWithinLimit(chunks);
    assertCoversInputExactlyOnce(input, chunks);
  }

  @Test
  void getLatestRecordBatch_chunksOverLimit() {
    DataQualityDataTimeSeriesDAO dao = mock(DataQualityDataTimeSeriesDAO.class, CALLS_REAL_METHODS);
    List<List<String>> chunks = new ArrayList<>();
    when(dao.getLatestRecordBatchInternal(anyList()))
        .thenAnswer(
            invocation -> {
              chunks.add(List.copyOf(invocation.getArgument(0)));
              return new ArrayList<>();
            });

    List<String> input = ids(OVER_LIMIT);
    dao.getLatestRecordBatch(input);

    assertChunksWithinLimit(chunks);
    assertCoversInputExactlyOnce(input, chunks);
  }

  @Test
  void listResultSummariesForTestSuites_chunksOverLimit() {
    TestCaseResultTimeSeriesDAO dao = mock(TestCaseResultTimeSeriesDAO.class, CALLS_REAL_METHODS);
    List<List<String>> chunks = new ArrayList<>();
    when(dao.listResultSummariesForTestSuitesInternal(anyList()))
        .thenAnswer(
            invocation -> {
              chunks.add(List.copyOf(invocation.getArgument(0)));
              return new ArrayList<>();
            });

    List<String> input = ids(OVER_LIMIT);
    dao.listResultSummariesForTestSuites(input);

    assertChunksWithinLimit(chunks);
    assertCoversInputExactlyOnce(input, chunks);
  }
}
