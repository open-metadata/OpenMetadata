package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.PredefinedRecognizer;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Recognizer;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.exception.BadCursorException;

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

  private Recognizer systemRecognizer(String name) {
    return new Recognizer()
        .withName(name)
        .withIsSystemDefault(true)
        .withEnabled(true)
        .withConfidenceThreshold(0.6)
        .withRecognizerConfig(
            new PredefinedRecognizer().withName(PredefinedRecognizer.Name.EMAIL_RECOGNIZER));
  }

  private Tag seedTag(List<Recognizer> recognizers) {
    return new Tag()
        .withName("Sensitive")
        .withFullyQualifiedName("PII.Sensitive")
        .withProvider(ProviderType.SYSTEM)
        .withRecognizers(recognizers)
        .withAutoClassificationEnabled(true)
        .withAutoClassificationPriority(100);
  }

  private Tag storedTag(List<Recognizer> recognizers) {
    return new Tag()
        .withFullyQualifiedName("PII.Sensitive")
        .withProvider(ProviderType.SYSTEM)
        .withRecognizers(new ArrayList<>(recognizers));
  }

  /** Mock wired so the reconcile logic runs for real while all DB access is stubbed out. */
  private TagRepository reconcilingRepository(Tag stored) {
    TagRepository repository = Mockito.mock(TagRepository.class);
    Mockito.doCallRealMethod().when(repository).reconcileSeededTags(Mockito.anyList());
    when(repository.missingSystemRecognizers(Mockito.any(), Mockito.any())).thenCallRealMethod();
    when(repository.findByNameOrNull(Mockito.anyString(), Mockito.any(Include.class)))
        .thenReturn(stored);
    return repository;
  }

  private Tag captureStoredTag(TagRepository repository) {
    ArgumentCaptor<Tag> captor = ArgumentCaptor.forClass(Tag.class);
    Mockito.verify(repository).store(captor.capture(), Mockito.eq(true));
    return captor.getValue();
  }

  @Test
  void test_reconcileSeededTags_restoresEverythingAfterAWipe() {
    Tag stored =
        storedTag(List.of())
            .withProvider(ProviderType.USER)
            .withAutoClassificationEnabled(false)
            .withAutoClassificationPriority(50);
    Tag seed =
        seedTag(List.of(systemRecognizer("EmailRecognizer"), systemRecognizer("CvvRecognizer")));
    TagRepository repository = reconcilingRepository(stored);

    repository.reconcileSeededTags(List.of(seed));

    Tag written = captureStoredTag(repository);
    assertEquals(
        List.of("EmailRecognizer", "CvvRecognizer"),
        written.getRecognizers().stream().map(Recognizer::getName).toList());
    written.getRecognizers().forEach(recognizer -> assertNotNull(recognizer.getId()));
    // Recognizers are inert without these, so a full wipe restores them too
    assertTrue(written.getAutoClassificationEnabled());
    assertEquals(100, written.getAutoClassificationPriority());
    assertEquals(ProviderType.SYSTEM, written.getProvider());
  }

  @Test
  void test_reconcileSeededTags_neverTouchesARecognizerTheUserEdited() {
    Recognizer edited =
        systemRecognizer("EmailRecognizer").withEnabled(false).withConfidenceThreshold(0.95);
    Tag stored =
        storedTag(List.of(edited))
            .withAutoClassificationEnabled(false)
            .withAutoClassificationPriority(30);
    Tag seed =
        seedTag(List.of(systemRecognizer("EmailRecognizer"), systemRecognizer("CvvRecognizer")));
    TagRepository repository = reconcilingRepository(stored);

    repository.reconcileSeededTags(List.of(seed));

    Tag written = captureStoredTag(repository);
    assertEquals(
        List.of("EmailRecognizer", "CvvRecognizer"),
        written.getRecognizers().stream().map(Recognizer::getName).toList());
    assertSame(edited, written.getRecognizers().getFirst());
    assertFalse(written.getRecognizers().getFirst().getEnabled());
    assertEquals(0.95, written.getRecognizers().getFirst().getConfidenceThreshold());
    // Only a newly seeded recognizer was missing, so the user's tag settings stand
    assertFalse(written.getAutoClassificationEnabled());
    assertEquals(30, written.getAutoClassificationPriority());
  }

  @Test
  void test_reconcileSeededTags_restoresAProviderDowngradedByAPut() {
    Tag stored =
        storedTag(List.of(systemRecognizer("EmailRecognizer")))
            .withProvider(ProviderType.USER)
            .withAutoClassificationEnabled(false)
            .withAutoClassificationPriority(30);
    Tag seed = seedTag(List.of(systemRecognizer("EmailRecognizer")));
    TagRepository repository = reconcilingRepository(stored);

    repository.reconcileSeededTags(List.of(seed));

    Tag written = captureStoredTag(repository);
    assertEquals(ProviderType.SYSTEM, written.getProvider());
    // Provider drift alone is no reason to touch anything the user owns
    assertEquals(1, written.getRecognizers().size());
    assertFalse(written.getAutoClassificationEnabled());
    assertEquals(30, written.getAutoClassificationPriority());
  }

  @Test
  void test_reconcileSeededTags_doesNotWriteWhenNothingHasDrifted() {
    Tag stored =
        storedTag(List.of(systemRecognizer("EmailRecognizer")))
            .withAutoClassificationEnabled(false);
    Tag seed = seedTag(List.of(systemRecognizer("EmailRecognizer")));
    TagRepository repository = reconcilingRepository(stored);

    repository.reconcileSeededTags(List.of(seed));

    Mockito.verify(repository, Mockito.never()).store(Mockito.any(Tag.class), Mockito.anyBoolean());
    assertFalse(stored.getAutoClassificationEnabled());
  }

  @Test
  void test_reconcileSeededTags_ignoresSeedRecognizersThatAreNotSystemDefaults() {
    Tag stored = storedTag(List.of());
    Tag seed = seedTag(List.of(systemRecognizer("EmailRecognizer").withIsSystemDefault(false)));
    TagRepository repository = reconcilingRepository(stored);

    repository.reconcileSeededTags(List.of(seed));

    Mockito.verify(repository, Mockito.never()).store(Mockito.any(Tag.class), Mockito.anyBoolean());
  }

  @Test
  void test_missingSystemRecognizers_copiesTheSeedAndMintsFreshIds() {
    TagRepository repository = Mockito.mock(TagRepository.class);
    when(repository.missingSystemRecognizers(Mockito.any(), Mockito.any())).thenCallRealMethod();
    Recognizer seeded = systemRecognizer("EmailRecognizer");

    List<Recognizer> missing = repository.missingSystemRecognizers(List.of(), List.of(seeded));

    assertEquals(1, missing.size());
    assertNotSame(seeded, missing.getFirst());
    assertNotNull(missing.getFirst().getId());
    assertNull(seeded.getId());
  }
}
