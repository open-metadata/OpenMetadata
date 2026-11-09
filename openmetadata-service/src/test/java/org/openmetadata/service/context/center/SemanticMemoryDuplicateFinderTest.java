package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.ContextMemoryType;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.llm.CompletionOptions;
import org.openmetadata.service.llm.CompletionResult;
import org.openmetadata.service.llm.LLMCompletionClient;
import org.openmetadata.service.llm.LLMCompletionException;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchResultListMapper;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilderFactory;
import org.openmetadata.service.search.security.ContextMemorySearchVisibility;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;

@ExtendWith(MockitoExtension.class)
class SemanticMemoryDuplicateFinderTest {
  @Mock private ContextMemoryRepository repository;
  @Mock private VectorIndexService vectorService;
  @Mock private LLMCompletionClient completionClient;
  @Mock private SearchRepository searchRepository;
  @Mock private SearchClient searchClient;

  private static final EntityReference HANDBOOK =
      new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE);

  private ContextMemory memory(UUID id, String question, String answer) {
    return new ContextMemory()
        .withId(id)
        .withQuestion(question)
        .withAnswer(answer)
        .withSourceType(ContextMemorySourceType.FILE_EXTRACTION)
        .withSourceEntity(HANDBOOK)
        .withEntityStatus(ContextMemoryStatus.APPROVED)
        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY));
  }

  /**
   * Every extracted memory is anchored, so an anonymous lookup finds none. The finder searches as an
   * admin that search can resolve, without needing a user named admin to exist.
   */
  @Test
  void searchesAsAResolvableAdminThatNeedsNoUserRecord() {
    ContextMemorySearchVisibility visibility =
        new ContextMemorySearchVisibility(new ElasticQueryBuilderFactory());

    assertTrue(visibility.isSubjectResolvable(SemanticMemoryDuplicateFinder.SEARCH_SUBJECT));
    assertFalse(visibility.isVisibilityEnforced(SemanticMemoryDuplicateFinder.SEARCH_SUBJECT));
  }

  private SemanticMemoryDuplicateFinder finderWithCandidate(ContextMemory candidate) {
    return finderWithCandidate(candidate, completionClient);
  }

  private SemanticMemoryDuplicateFinder finderWithCandidate(
      ContextMemory candidate, LLMCompletionClient client) {
    when(vectorService.search(
            anyString(),
            any(),
            eq(5),
            eq(0),
            eq(20),
            eq(0.0),
            isNull(),
            eq(SemanticMemoryDuplicateFinder.SEARCH_SUBJECT)))
        .thenReturn(
            new VectorSearchResponse(
                1L, List.of(Map.of("parentId", candidate.getId().toString()))));
    when(repository.get(
            isNull(), eq(candidate.getId()), isNull(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(candidate);
    lenient().when(repository.hasOrgWideAnchor(candidate)).thenReturn(true);
    return new SemanticMemoryDuplicateFinder(
        repository, () -> vectorService, () -> searchRepository, client);
  }

  @Test
  void proseOnBothAttemptsFailsReconciliationWithoutLinkingEarlierMatches() {
    AtomicInteger attempts = new AtomicInteger();
    LLMCompletionClient client =
        new LLMCompletionClient(1) {
          @Override
          protected CompletionResult doComplete(
              String systemPrompt, String userPrompt, CompletionOptions options) {
            attempts.incrementAndGet();
            return new CompletionResult("I cannot identify an equivalent fact.", 0, 0);
          }

          @Override
          public String getModelId() {
            return "test";
          }
        };
    ContextMemory candidate =
        memory(UUID.randomUUID(), "What is GDPR?", "A data protection regulation.");
    EntityReference file =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE);
    when(repository.listExtractedMemories(file.getId(), Entity.CONTEXT_FILE)).thenReturn(List.of());
    ContextMemoryReconciler reconciler =
        new ContextMemoryReconciler(repository, finderWithCandidate(candidate, client));

    LLMCompletionException failure =
        assertThrows(
            LLMCompletionException.class,
            () ->
                reconciler.reconcile(
                    file,
                    Entity.CONTEXT_FILE,
                    List.of(
                        memory(UUID.randomUUID(), candidate.getQuestion(), candidate.getAnswer()),
                        memory(
                            UUID.randomUUID(),
                            "Define personal data",
                            "An identifiable person."))));

    assertEquals("Failed to parse LLM JSON array response", failure.getMessage());
    assertEquals(2, attempts.get());
    verify(repository, never()).linkExtractedMemory(any(), any());
    verify(repository, never()).create(any(), any());
  }

  private void rankedHits(List<ContextMemory> memories) throws IOException {
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    List<Map<String, Object>> hits =
        memories.stream()
            .map(memory -> Map.<String, Object>of("id", memory.getId().toString()))
            .toList();
    when(searchClient.searchSimilarContextMemories(anyString(), anyString(), eq(20)))
        .thenReturn(new SearchResultListMapper(hits, hits.size()));
  }

  private void eligible(ContextMemory candidate) {
    lenient()
        .when(
            repository.get(
                isNull(), eq(candidate.getId()), isNull(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(candidate);
    lenient().when(repository.hasOrgWideAnchor(candidate)).thenReturn(true);
  }

  private SemanticMemoryDuplicateFinder keywordFinder() {
    return new SemanticMemoryDuplicateFinder(
        repository, () -> null, () -> searchRepository, completionClient);
  }

  /** A linked fact stays anchored to its own file, hiding it from readers of a restricted one. */
  @Test
  void factAnchoredToARestrictedFileIsNotReused() throws Exception {
    ContextMemory candidate =
        memory(UUID.randomUUID(), "What is churn?", "Churn is the share of customers lost.");
    SemanticMemoryDuplicateFinder finder = finderWithCandidate(candidate);
    when(repository.hasOrgWideAnchor(candidate)).thenReturn(false);
    rankedHits(List.of());

    assertEquals(
        new DuplicateMatch.None(),
        finder.findMatch(
            memory(UUID.randomUUID(), candidate.getQuestion(), candidate.getAnswer())));
  }

  @Test
  void identicalFactReusesCandidateWithoutAnotherModelCall() {
    ContextMemory candidate =
        memory(UUID.randomUUID(), "What is churn?", "Churn is the share of customers lost.");
    ContextMemory derived =
        memory(UUID.randomUUID(), " what is churn? ", "Churn is the share of customers lost.");

    assertEquals(
        new DuplicateMatch.Equivalent(candidate),
        finderWithCandidate(candidate).findMatch(derived));
    verify(completionClient, never()).completeStructured(anyString(), anyString(), any());
  }

  @Test
  void semanticCandidateIsReusedOnlyWhenFactsAreEquivalent() {
    ContextMemory candidate =
        memory(UUID.randomUUID(), "What is churn?", "Customers lost during the period.");
    ContextMemory derived =
        memory(UUID.randomUUID(), "Define customer churn", "The portion of customers who leave.");
    when(completionClient.completeStructured(
            anyString(), anyString(), eq(SemanticMemoryDuplicateFinder.MatchChoice.class)))
        .thenReturn(List.of(new SemanticMemoryDuplicateFinder.MatchChoice(0)));

    assertEquals(
        new DuplicateMatch.Equivalent(candidate),
        finderWithCandidate(candidate).findMatch(derived));
  }

  @Test
  void oppositeSignsCannotReuseAnApprovedFact() throws Exception {
    ContextMemory candidate =
        memory(UUID.randomUUID(), "What is the growth rate?", "The growth rate is -15%.");
    ContextMemory derived =
        memory(UUID.randomUUID(), "What is the growth rate?", "The growth rate is +15%.");

    assertEquals(new DuplicateMatch.None(), finderWithCandidate(candidate).findMatch(derived));
    verify(completionClient, never()).completeStructured(anyString(), anyString(), any());
  }

  /** An added number, a year here, rewords a value; only a replaced number changes it. */
  @Test
  void anAddedYearDoesNotPreventReusingTheSameApprovedValue() {
    ContextMemory candidate =
        memory(UUID.randomUUID(), "What is the retention window?", "Data is kept for 90 days.");
    ContextMemory derived =
        memory(
            UUID.randomUUID(), "What is the retention window?", "Data is kept for 90 days (2025).");
    when(completionClient.completeStructured(
            anyString(), anyString(), eq(SemanticMemoryDuplicateFinder.MatchChoice.class)))
        .thenReturn(List.of(new SemanticMemoryDuplicateFinder.MatchChoice(0)));

    assertEquals(
        new DuplicateMatch.Equivalent(candidate),
        finderWithCandidate(candidate).findMatch(derived));
  }

  /** A citation is no value: renumbering "(section 3)" to "(section 4)" keeps the fact reusable. */
  @Test
  void aRenumberedCitationDoesNotPreventReusingTheSameApprovedValue() {
    ContextMemory candidate =
        memory(
            UUID.randomUUID(),
            "What is the retention window?",
            "Data is kept for 90 days (section 3).");
    ContextMemory derived =
        memory(
            UUID.randomUUID(),
            "What is the retention window?",
            "Data is kept for 90 days (section 4).");
    when(completionClient.completeStructured(
            anyString(), anyString(), eq(SemanticMemoryDuplicateFinder.MatchChoice.class)))
        .thenReturn(List.of(new SemanticMemoryDuplicateFinder.MatchChoice(0)));

    assertEquals(
        new DuplicateMatch.Equivalent(candidate),
        finderWithCandidate(candidate).findMatch(derived));
  }

  @Test
  void relatedButConflictingFactIsNotReused() throws Exception {
    ContextMemory candidate =
        memory(UUID.randomUUID(), "What is the retention window?", "Data is kept for 90 days.");
    ContextMemory derived =
        memory(UUID.randomUUID(), "What is the retention window?", "Data is kept for 30 days.");

    assertEquals(new DuplicateMatch.None(), finderWithCandidate(candidate).findMatch(derived));
    verify(completionClient, never()).completeStructured(anyString(), anyString(), any());
  }

  @Test
  void keywordIndexFindsCandidateWhenVectorSearchFails() throws Exception {
    ContextMemory candidate =
        memory(UUID.randomUUID(), "What is churn?", "Churn is the share of customers lost.");
    when(vectorService.search(
            anyString(),
            any(),
            eq(5),
            eq(0),
            eq(20),
            eq(0.0),
            isNull(),
            eq(SemanticMemoryDuplicateFinder.SEARCH_SUBJECT)))
        .thenThrow(new IllegalStateException("vector index unavailable"));
    rankedHits(List.of(candidate));
    eligible(candidate);

    DuplicateMatch found =
        new SemanticMemoryDuplicateFinder(
                repository, () -> vectorService, () -> searchRepository, completionClient)
            .findMatch(memory(UUID.randomUUID(), candidate.getQuestion(), candidate.getAnswer()));

    assertEquals(new DuplicateMatch.Equivalent(candidate), found);
    ArgumentCaptor<String> text = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<String> filter = ArgumentCaptor.forClass(String.class);
    verify(searchClient).searchSimilarContextMemories(text.capture(), filter.capture(), eq(20));
    assertEquals("what is churn churn is the share of customers lost", text.getValue());
    assertTrue(filter.getValue().contains("FileExtraction"));
    assertTrue(filter.getValue().contains("{\"deleted\":false}"), "an archived fact is no match");
  }

  /** Of the twenty ranked hits, the first five that may be reused go to the judge. */
  @Test
  void judgesTheFirstFiveEligibleOfTheRankedHits() throws Exception {
    List<ContextMemory> ranked = new ArrayList<>();
    for (String topic : List.of("alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta")) {
      ranked.add(memory(UUID.randomUUID(), "What is " + topic + "?", "Rules for " + topic + "."));
    }
    ranked.forEach(this::eligible);
    when(repository.hasOrgWideAnchor(ranked.getFirst())).thenReturn(false);
    rankedHits(ranked);
    ArgumentCaptor<String> prompt = ArgumentCaptor.forClass(String.class);
    when(completionClient.completeStructured(
            anyString(), prompt.capture(), eq(SemanticMemoryDuplicateFinder.MatchChoice.class)))
        .thenReturn(List.of());

    assertEquals(
        new DuplicateMatch.None(),
        keywordFinder().findMatch(memory(UUID.randomUUID(), "What is omega?", "Omega rules.")));

    List<String> judged = new ArrayList<>();
    JsonUtils.readTree(prompt.getValue())
        .path("candidates")
        .forEach(candidate -> judged.add(candidate.path("question").asText()));
    assertEquals(
        ranked.subList(1, 6).stream().map(ContextMemory::getQuestion).toList(),
        judged,
        "the restricted best hit is skipped and the sixth eligible one is never judged");
  }

  /** The type an extraction gives a fact is no part of the claim, so the judge decides. */
  @Test
  void aMemoryOfAnotherTypeIsLeftToTheJudge() throws Exception {
    ContextMemory candidate =
        memory(UUID.randomUUID(), "What is churn?", "Customers lost during the period.")
            .withMemoryType(ContextMemoryType.FAQ);
    ContextMemory derived =
        memory(UUID.randomUUID(), "Define customer churn", "The portion of customers who leave.")
            .withMemoryType(ContextMemoryType.NOTE);
    rankedHits(List.of(candidate));
    eligible(candidate);
    when(completionClient.completeStructured(
            anyString(), anyString(), eq(SemanticMemoryDuplicateFinder.MatchChoice.class)))
        .thenReturn(List.of(new SemanticMemoryDuplicateFinder.MatchChoice(0)));

    assertEquals(new DuplicateMatch.Equivalent(candidate), keywordFinder().findMatch(derived));
  }

  /** A fact awaiting review or decided is a candidate too: the lookup asks for every stage. */
  @Test
  void theLookupAdmitsEveryStageAndCorrections() throws Exception {
    ContextMemory waiting =
        memory(UUID.randomUUID(), "What is churn?", "Churn is the share of customers lost.")
            .withEntityStatus(ContextMemoryStatus.UNPROCESSED);
    rankedHits(List.of(waiting));
    eligible(waiting);

    assertEquals(
        new DuplicateMatch.Equivalent(waiting),
        keywordFinder()
            .findMatch(memory(UUID.randomUUID(), waiting.getQuestion(), waiting.getAnswer())));
    ArgumentCaptor<String> filter = ArgumentCaptor.forClass(String.class);
    verify(searchClient).searchSimilarContextMemories(anyString(), filter.capture(), eq(20));
    assertFalse(filter.getValue().contains("entityStatus"), filter.getValue());
    assertTrue(
        filter.getValue().contains("{\"terms\":{\"sourceType\":[\"FileExtraction\",\"Manual\"]}}"),
        filter.getValue());
    assertTrue(filter.getValue().contains("{\"visibility\":\"Entity\"}"), filter.getValue());
  }

  /** A correction still linked to its document is a candidate; a note citing none is not. */
  @Test
  void aCorrectionIsACandidateButANoteWithoutADocumentIsNot() throws Exception {
    ContextMemory note =
        memory(UUID.randomUUID(), "What is churn?", "Churn is the share of customers lost.")
            .withSourceType(ContextMemorySourceType.MANUAL)
            .withSourceEntity(null);
    ContextMemory correction =
        memory(UUID.randomUUID(), note.getQuestion(), note.getAnswer())
            .withSourceType(ContextMemorySourceType.MANUAL);
    rankedHits(List.of(note, correction));
    eligible(note);
    eligible(correction);

    assertEquals(
        new DuplicateMatch.Equivalent(correction),
        keywordFinder().findMatch(memory(UUID.randomUUID(), note.getQuestion(), note.getAnswer())));
  }

  /**
   * As re-extraction holds values (ADR:2026-11-03-extracted-memories-can-await-review-and-keep-conflicting-values),
   * a replaced number beside a rejected value is a new claim: only a correction holds it.
   */
  @Test
  void aValueReplacingARejectedFactsNumberIsANewClaim() throws Exception {
    ContextMemory rejected =
        memory(UUID.randomUUID(), "What is the refund window?", "Refunds within 30 days.")
            .withEntityStatus(ContextMemoryStatus.REJECTED);
    rankedHits(List.of(rejected));
    eligible(rejected);

    assertEquals(
        new DuplicateMatch.None(),
        keywordFinder()
            .findMatch(
                memory(UUID.randomUUID(), rejected.getQuestion(), "Refunds within 45 days.")));
    verify(completionClient, never()).completeStructured(anyString(), anyString(), any());
  }

  /** Another year's look-alike may be the decided fact reworded; Draft awaits a decision. */
  @ParameterizedTest
  @CsvSource({
    "REJECTED, true",
    "SUPERSEDED, true",
    "INVALIDATED, true",
    "DEPRECATED, true",
    "ARCHIVED, true",
    "DRAFT, false",
    "UNPROCESSED, false",
    "APPROVED, false"
  })
  void onlyADecidedFactHoldsALookAlikeForAnotherYear(ContextMemoryStatus stage, boolean held)
      throws Exception {
    ContextMemory existing =
        memory(UUID.randomUUID(), "What was the VAT rate in 2024?", "20%").withEntityStatus(stage);
    rankedHits(List.of(existing));
    eligible(existing);

    DuplicateMatch match =
        keywordFinder()
            .findMatch(memory(UUID.randomUUID(), "What was the VAT rate in 2025?", "20%"));

    assertEquals(
        held ? new DuplicateMatch.ConflictsWithDecision(existing) : new DuplicateMatch.None(),
        match);
    verify(completionClient, never()).completeStructured(anyString(), anyString(), any());
  }

  @Test
  void unavailableSearchDoesNotCreateAnUncheckedDuplicate() throws Exception {
    when(vectorService.search(
            anyString(),
            any(),
            eq(5),
            eq(0),
            eq(20),
            eq(0.0),
            isNull(),
            eq(SemanticMemoryDuplicateFinder.SEARCH_SUBJECT)))
        .thenThrow(new IllegalStateException("vector index unavailable"));
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchClient.searchSimilarContextMemories(anyString(), anyString(), eq(20)))
        .thenThrow(new IOException("search index unavailable"));
    SemanticMemoryDuplicateFinder finder =
        new SemanticMemoryDuplicateFinder(
            repository, () -> vectorService, () -> searchRepository, completionClient);

    assertThrows(
        IllegalStateException.class,
        () -> finder.findMatch(memory(UUID.randomUUID(), "What is churn?", "Customers leave.")));
  }
}
