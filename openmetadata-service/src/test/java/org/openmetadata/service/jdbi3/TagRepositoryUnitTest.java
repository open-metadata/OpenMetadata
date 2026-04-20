package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.type.PredefinedRecognizer;
import org.openmetadata.schema.type.Recognizer;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.exception.BadCursorException;
import org.openmetadata.service.util.FullyQualifiedName;

public class TagRepositoryUnitTest {
  private static final TagRepository tagRepository;

  static {
    // Mock class instantiation to avoid anything that might be coupled to DB
    tagRepository = Mockito.mock(TagRepository.class);
    when(tagRepository.getRecognizersOfTag(
            Mockito.isA(Tag.class),
            Mockito.nullable(String.class),
            Mockito.nullable(String.class),
            Mockito.anyInt()))
        .thenCallRealMethod();
    when(tagRepository.parseCursorMap(Mockito.nullable(String.class))).thenCallRealMethod();
  }

  private Tag createTagWithRecognizers(int count) {
    List<Recognizer> recognizers =
        IntStream.range(0, count)
            .mapToObj(
                i ->
                    new Recognizer()
                        .withName("Recognizer_" + i)
                        .withId(UUID.randomUUID())
                        .withRecognizerConfig(
                            new PredefinedRecognizer()
                                .withName(PredefinedRecognizer.Name.EMAIL_RECOGNIZER)))
            .toList();
    return new Tag().withRecognizers(recognizers);
  }

  private String createCursor(UUID id, String name) {
    String json = String.format("{\"id\": \"%s\", \"name\": \"%s\"}", id.toString(), name);
    return Base64.getUrlEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8));
  }

  @Test
  void test_tagRecognizersForwardPaging_returnsLimitAmountOrRemainder() {
    Tag tag = createTagWithRecognizers(50);

    ResultList<Recognizer> result = tagRepository.getRecognizersOfTag(tag, null, null, 30);
    assertEquals(30, result.getData().size());
    assertEquals(50, result.getPaging().getTotal());

    assertEquals(tag.getRecognizers().getFirst(), result.getData().getFirst());
    assertEquals(tag.getRecognizers().get(29), result.getData().getLast());

    assertNull(result.getPaging().getBefore());
    assertNotNull(result.getPaging().getAfter());

    result = tagRepository.getRecognizersOfTag(tag, null, result.getPaging().getAfter(), 30);

    assertEquals(20, result.getData().size());
    assertEquals(50, result.getPaging().getTotal());

    assertEquals(tag.getRecognizers().get(30), result.getData().getFirst());
    assertEquals(tag.getRecognizers().getLast(), result.getData().getLast());

    assertNotNull(result.getPaging().getBefore());
    assertNull(result.getPaging().getAfter());
  }

  @Test
  void test_tagRecognizersDownwardPaging_returnsLimitAmountOrRemainder() {
    Tag tag = createTagWithRecognizers(50);

    Recognizer lastRecognizer = tag.getRecognizers().getLast();
    String before = createCursor(lastRecognizer.getId(), lastRecognizer.getName());

    ResultList<Recognizer> result = tagRepository.getRecognizersOfTag(tag, before, null, 30);
    assertEquals(30, result.getData().size());
    assertEquals(50, result.getPaging().getTotal());

    assertEquals(
        tag.getRecognizers().get(tag.getRecognizers().size() - 2), result.getData().getFirst());
    assertEquals(tag.getRecognizers().get(19), result.getData().getLast());

    assertNotNull(result.getPaging().getBefore());
    assertNotNull(result.getPaging().getAfter());

    result = tagRepository.getRecognizersOfTag(tag, result.getPaging().getAfter(), null, 30);

    assertEquals(19, result.getData().size());
    assertEquals(50, result.getPaging().getTotal());

    assertEquals(tag.getRecognizers().get(18), result.getData().getFirst());
    assertEquals(tag.getRecognizers().getFirst(), result.getData().getLast());

    assertNotNull(result.getPaging().getBefore());
    assertNull(result.getPaging().getAfter());
  }

  @Test
  void test_emptyRecognizersList_returnsEmptyResult() {
    Tag tag = new Tag().withRecognizers(new ArrayList<>());

    ResultList<Recognizer> result = tagRepository.getRecognizersOfTag(tag, null, null, 10);

    assertEquals(0, result.getData().size());
    assertEquals(0, result.getPaging().getTotal());
    assertNull(result.getPaging().getBefore());
    assertNull(result.getPaging().getAfter());
  }

  @Test
  void test_nullRecognizersList_returnsEmptyResult() {
    Tag tag = new Tag().withRecognizers(null);

    ResultList<Recognizer> result = tagRepository.getRecognizersOfTag(tag, null, null, 10);

    assertEquals(0, result.getData().size());
    assertEquals(0, result.getPaging().getTotal());
    assertNull(result.getPaging().getBefore());
    assertNull(result.getPaging().getAfter());
  }

  @Test
  void test_singleRecognizer_returnsOneResult() {
    Tag tag = createTagWithRecognizers(1);

    ResultList<Recognizer> result = tagRepository.getRecognizersOfTag(tag, null, null, 10);

    assertEquals(1, result.getData().size());
    assertEquals(1, result.getPaging().getTotal());
    assertEquals(tag.getRecognizers().getFirst(), result.getData().getFirst());
    assertNull(result.getPaging().getBefore());
    assertNull(result.getPaging().getAfter());
  }

  @Test
  void test_limitZero_returnsAllRecognizers() {
    Tag tag = createTagWithRecognizers(25);

    ResultList<Recognizer> result = tagRepository.getRecognizersOfTag(tag, null, null, 0);

    assertEquals(25, result.getData().size());
    assertEquals(25, result.getPaging().getTotal());
    assertEquals(tag.getRecognizers().getFirst(), result.getData().getFirst());
    assertEquals(tag.getRecognizers().getLast(), result.getData().getLast());
    assertNull(result.getPaging().getBefore());
    assertNull(result.getPaging().getAfter());
  }

  @Test
  void test_limitOne_returnsOneResult() {
    Tag tag = createTagWithRecognizers(10);

    ResultList<Recognizer> result = tagRepository.getRecognizersOfTag(tag, null, null, 1);

    assertEquals(1, result.getData().size());
    assertEquals(10, result.getPaging().getTotal());
    assertEquals(tag.getRecognizers().getFirst(), result.getData().getFirst());
    assertNull(result.getPaging().getBefore());
    assertNotNull(result.getPaging().getAfter());
  }

  @Test
  void test_limitExceedsTotal_returnsAllRecognizers() {
    Tag tag = createTagWithRecognizers(10);

    ResultList<Recognizer> result = tagRepository.getRecognizersOfTag(tag, null, null, 100);

    assertEquals(10, result.getData().size());
    assertEquals(10, result.getPaging().getTotal());
    assertEquals(tag.getRecognizers().getFirst(), result.getData().getFirst());
    assertEquals(tag.getRecognizers().getLast(), result.getData().getLast());
    assertNull(result.getPaging().getBefore());
    assertNull(result.getPaging().getAfter());
  }

  @Test
  void test_invalidCursorFormat_throwsBadCursorException() {
    Tag tag = createTagWithRecognizers(10);
    String invalidCursor =
        Base64.getUrlEncoder().encodeToString("not a json".getBytes(StandardCharsets.UTF_8));

    assertThrows(
        BadCursorException.class,
        () -> tagRepository.getRecognizersOfTag(tag, null, invalidCursor, 10));
  }

  @Test
  void test_cursorMissingId_throwsBadCursorException() {
    Tag tag = createTagWithRecognizers(10);
    String cursorWithoutId =
        Base64.getUrlEncoder()
            .encodeToString("{\"name\": \"test\"}".getBytes(StandardCharsets.UTF_8));

    assertThrows(
        BadCursorException.class,
        () -> tagRepository.getRecognizersOfTag(tag, null, cursorWithoutId, 10));
  }

  @Test
  void test_cursorWithNonExistentId_returnsEmptyResult() {
    Tag tag = createTagWithRecognizers(10);
    String nonExistentCursor = createCursor(UUID.randomUUID(), "NonExistent");

    ResultList<Recognizer> result =
        tagRepository.getRecognizersOfTag(tag, null, nonExistentCursor, 10);

    assertEquals(0, result.getData().size());
    assertEquals(10, result.getPaging().getTotal());
  }

  @Test
  void test_paginationBoundaries_firstPage() {
    Tag tag = createTagWithRecognizers(30);

    ResultList<Recognizer> result = tagRepository.getRecognizersOfTag(tag, null, null, 10);

    assertEquals(10, result.getData().size());
    assertEquals(tag.getRecognizers().get(0), result.getData().get(0));
    assertEquals(tag.getRecognizers().get(9), result.getData().get(9));
    assertNull(result.getPaging().getBefore());
    assertNotNull(result.getPaging().getAfter());
  }

  @Test
  void test_paginationBoundaries_middlePage() {
    Tag tag = createTagWithRecognizers(30);

    ResultList<Recognizer> firstPage = tagRepository.getRecognizersOfTag(tag, null, null, 10);
    ResultList<Recognizer> secondPage =
        tagRepository.getRecognizersOfTag(tag, null, firstPage.getPaging().getAfter(), 10);

    assertEquals(10, secondPage.getData().size());
    assertEquals(tag.getRecognizers().get(10), secondPage.getData().get(0));
    assertEquals(tag.getRecognizers().get(19), secondPage.getData().get(9));
    assertNotNull(secondPage.getPaging().getBefore());
    assertNotNull(secondPage.getPaging().getAfter());
  }

  @Test
  void test_paginationBoundaries_lastPage() {
    Tag tag = createTagWithRecognizers(30);

    ResultList<Recognizer> firstPage = tagRepository.getRecognizersOfTag(tag, null, null, 10);
    ResultList<Recognizer> secondPage =
        tagRepository.getRecognizersOfTag(tag, null, firstPage.getPaging().getAfter(), 10);
    ResultList<Recognizer> thirdPage =
        tagRepository.getRecognizersOfTag(tag, null, secondPage.getPaging().getAfter(), 10);

    assertEquals(10, thirdPage.getData().size());
    assertEquals(tag.getRecognizers().get(20), thirdPage.getData().get(0));
    assertEquals(tag.getRecognizers().get(29), thirdPage.getData().get(9));
    assertNotNull(thirdPage.getPaging().getBefore());
    assertNull(thirdPage.getPaging().getAfter());
  }

  // ===================================================================
  // USAGE COUNT QUERY TESTS — verifies batchFetchUsageCounts uses correct hash
  //
  // tag_usage.tagFQNHash stores hashes produced by FullyQualifiedName.buildHash:
  // each FQN segment is hashed individually and joined with ".".
  // e.g. "PII.Sensitive" → hash("PII") + "." + hash("Sensitive")
  //
  // The original bug used MySQL's MD5(fullFqnString) directly in the SQL, which
  // computes MD5("PII.Sensitive") — a flat 32-char hex string that never matches
  // any row, returning usageCount = 0 for every tag.
  // ===================================================================

  private static final TagRepository realTagRepository;

  static {
    realTagRepository = Mockito.mock(TagRepository.class);
    when(realTagRepository.buildUsageCountQuery(Mockito.anyList())).thenCallRealMethod();
  }

  @Test
  void test_usageCountQuery_containsCorrectHashNotRawFqn() {
    String tagFqn = "PII.Sensitive";
    String query = realTagRepository.buildUsageCountQuery(List.of(tagFqn));
    String expectedHash = FullyQualifiedName.buildHash(tagFqn);

    assertTrue(
        query.contains(expectedHash), "Query must embed the buildHash result, not the raw FQN");
    assertTrue(expectedHash.contains("."), "buildHash of a multi-segment FQN must contain '.'");
  }

  @Test
  void test_usageCountQuery_doesNotContainRawFqnAsHash() {
    String tagFqn = "PII.Sensitive";
    String query = realTagRepository.buildUsageCountQuery(List.of(tagFqn));

    // The raw FQN appears once as the SELECT label — but must NOT appear inside tagFQNHash = '...'
    // (which would be the broken MD5(fqn) pattern — a flat hash with no dot)
    String expectedHash = FullyQualifiedName.buildHash(tagFqn);
    String brokenPattern = "tagFQNHash = '" + tagFqn + "'";
    assertTrue(!query.contains(brokenPattern), "Query must not use raw FQN as the hash value");
    assertTrue(
        query.contains("tagFQNHash = '" + expectedHash + "'"),
        "Query must use buildHash result for tagFQNHash comparison");
  }

  @Test
  void test_usageCountQuery_multipleTagsUnionAll() {
    List<String> tagFqns = List.of("PII.Sensitive", "PII.Personal", "Tier.Tier1");
    String query = realTagRepository.buildUsageCountQuery(tagFqns);

    assertEquals(2, countOccurrences(query, "UNION ALL"), "3 tags must produce 2 UNION ALL joins");
    for (String fqn : tagFqns) {
      String hash = FullyQualifiedName.buildHash(fqn);
      assertTrue(query.contains(hash), "Query must contain the correct hash for: " + fqn);
    }
  }

  @Test
  void test_usageCountQuery_emptyList_returnsEmptyString() {
    String query = realTagRepository.buildUsageCountQuery(List.of());
    assertTrue(query.isEmpty(), "Empty tag list must produce empty query string");
  }

  private static int countOccurrences(String text, String pattern) {
    int count = 0;
    int idx = 0;
    while ((idx = text.indexOf(pattern, idx)) != -1) {
      count++;
      idx += pattern.length();
    }
    return count;
  }

  @Test
  void test_backwardPaginationFromMiddle_returnsCorrectOrder() {
    Tag tag = createTagWithRecognizers(30);

    Recognizer middleRecognizer = tag.getRecognizers().get(15);
    String beforeCursor = createCursor(middleRecognizer.getId(), middleRecognizer.getName());

    ResultList<Recognizer> result = tagRepository.getRecognizersOfTag(tag, beforeCursor, null, 5);

    assertEquals(5, result.getData().size());
    assertEquals(tag.getRecognizers().get(14), result.getData().get(0));
    assertEquals(tag.getRecognizers().get(10), result.getData().get(4));
  }
}
