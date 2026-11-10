package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.ServiceUnavailableException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryScope;
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

  /** Unless a test says otherwise, everyone may read every document. */
  @BeforeEach
  void everyDocumentIsReadByEveryone() {
    lenient().when(repository.isReadableByEveryone(any())).thenReturn(true);
  }

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

  private SemanticMemoryDuplicateFinder finderWithCandidate(ContextMemory candidate)
      throws IOException {
    return finderWithCandidate(candidate, completionClient);
  }

  private SemanticMemoryDuplicateFinder finderWithCandidate(
      ContextMemory candidate, LLMCompletionClient client) throws IOException {
    vectorHits(List.of(candidate));
    emptyIndex();
    when(repository.get(
            isNull(), eq(candidate.getId()), isNull(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(candidate);
    lenient().when(repository.hasOrgWideAnchor(candidate)).thenReturn(true);
    return new SemanticMemoryDuplicateFinder(
        repository, () -> vectorService, () -> searchRepository, client);
  }

  @Test
  void proseOnBothAttemptsFailsReconciliationWithoutLinkingEarlierMatches() throws Exception {
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

  private void vectorHits(List<ContextMemory> memories) {
    List<Map<String, Object>> hits =
        memories.stream()
            .map(memory -> Map.<String, Object>of("parentId", memory.getId().toString()))
            .toList();
    when(vectorService.search(
            anyString(),
            any(),
            eq(5),
            eq(0),
            eq(20),
            eq(0.0),
            isNull(),
            eq(SemanticMemoryDuplicateFinder.SEARCH_SUBJECT)))
        .thenReturn(new VectorSearchResponse(1L, hits));
  }

  /** The memory index ranks nothing beyond what vector search returned. */
  private void emptyIndex() throws IOException {
    lenient().when(searchRepository.getSearchClient()).thenReturn(searchClient);
    lenient()
        .when(searchClient.searchSimilarContextMemories(anyString(), anyString(), eq(20)))
        .thenReturn(new SearchResultListMapper(List.of(), 0));
  }

  private static List<String> judgedQuestions(String prompt) {
    List<String> judged = new ArrayList<>();
    JsonUtils.readTree(prompt)
        .path("candidates")
        .forEach(candidate -> judged.add(candidate.path("question").asText()));
    return judged;
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

    assertEquals(
        new DuplicateMatch.None(),
        finder.findMatch(
            memory(UUID.randomUUID(), candidate.getQuestion(), candidate.getAnswer())));
  }

  @Test
  void identicalFactReusesCandidateWithoutAnotherModelCall() throws Exception {
    ContextMemory candidate =
        memory(UUID.randomUUID(), "What is churn?", "Churn is the share of customers lost.");
    ContextMemory derived =
        memory(UUID.randomUUID(), " what is churn? ", "Churn is the share of customers lost.");

    assertEquals(
        new DuplicateMatch.Equivalent(candidate),
        finderWithCandidate(candidate).findMatch(derived));
    verify(completionClient, never()).completeStructured(anyString(), anyString(), any());
  }

  /** A provider with no judge keeps the exact-match shortcut; a rewording is a new fact. */
  @Test
  void withoutAJudgeOnlyExactMatchesLink() throws Exception {
    ContextMemory stated =
        memory(UUID.randomUUID(), "What is churn?", "Churn is the share of customers lost.");
    rankedHits(List.of(stated));
    eligible(stated);
    SemanticMemoryDuplicateFinder finder =
        SemanticMemoryDuplicateFinder.exactOnly(repository, () -> null, () -> searchRepository);

    assertEquals(
        new DuplicateMatch.Equivalent(stated),
        finder.findMatch(memory(UUID.randomUUID(), " what is churn? ", stated.getAnswer())));
    assertEquals(
        new DuplicateMatch.None(),
        finder.findMatch(
            memory(
                UUID.randomUUID(),
                "Define customer churn",
                "The portion of customers who leave.")));
  }

  @Test
  void semanticCandidateIsReusedOnlyWhenFactsAreEquivalent() throws Exception {
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
  void anAddedYearDoesNotPreventReusingTheSameApprovedValue() throws Exception {
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
  void aRenumberedCitationDoesNotPreventReusingTheSameApprovedValue() throws Exception {
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
        filter.getValue().contains("{\"term\":{\"sourceType\":\"FileExtraction\"}}"),
        filter.getValue());
    assertTrue(
        filter.getValue().contains("{\"term\":{\"sourceType\":\"Manual\"}}"), filter.getValue());
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

  /** A replaced number beside a decision holds only a value for a look-alike question. */
  @Test
  void anUnrelatedQuestionWithDifferentNumbersIsNoConflict() throws Exception {
    ContextMemory rejected =
        memory(
                UUID.randomUUID(),
                "How many vacation days do employees get?",
                "Employees get 25 vacation days per year.")
            .withEntityStatus(ContextMemoryStatus.REJECTED);
    rankedHits(List.of(rejected));
    eligible(rejected);

    assertEquals(
        new DuplicateMatch.None(),
        keywordFinder()
            .findMatch(
                memory(
                    UUID.randomUUID(),
                    "What is the refund window?",
                    "Refunds are accepted within 30 days.")));
    verify(completionClient, never()).completeStructured(anyString(), anyString(), any());
  }

  /**
   * Vector search returns Approved memories only, so the memory index is asked too: the rankings
   * alternate, and a waiting equivalent the vector lookup cannot return is judged and linked.
   */
  @Test
  void aWaitingMemoryVectorSearchCannotReturnIsJudgedAndLinked() throws Exception {
    ContextMemory retention =
        memory(
            UUID.randomUUID(),
            "What is customer retention?",
            "Retention is the share of customers kept.");
    ContextMemory growth =
        memory(
            UUID.randomUUID(), "What is customer growth?", "Growth is the share of new customers.");
    ContextMemory waiting =
        memory(UUID.randomUUID(), "What is churn?", "Churn is the share of customers lost.")
            .withEntityStatus(ContextMemoryStatus.UNPROCESSED);
    vectorHits(List.of(retention, growth));
    rankedHits(List.of(waiting));
    List.of(retention, growth, waiting).forEach(this::eligible);
    ArgumentCaptor<String> prompt = ArgumentCaptor.forClass(String.class);
    when(completionClient.completeStructured(
            anyString(), prompt.capture(), eq(SemanticMemoryDuplicateFinder.MatchChoice.class)))
        .thenReturn(List.of(new SemanticMemoryDuplicateFinder.MatchChoice(1)));
    EntityReference file =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE);
    when(repository.listExtractedMemories(file.getId(), Entity.CONTEXT_FILE)).thenReturn(List.of());

    new ContextMemoryReconciler(
            repository,
            new SemanticMemoryDuplicateFinder(
                repository, () -> vectorService, () -> searchRepository, completionClient))
        .reconcile(
            file,
            Entity.CONTEXT_FILE,
            List.of(
                memory(
                    UUID.randomUUID(),
                    "Define customer churn",
                    "The portion of customers who leave.")));

    verify(repository).linkExtractedMemory(waiting.getId(), file);
    verify(repository, never()).create(any(), any());
    assertEquals(
        List.of(retention.getQuestion(), waiting.getQuestion(), growth.getQuestion()),
        judgedQuestions(prompt.getValue()),
        "the vector and memory index rankings alternate");
  }

  /** Approval reads decided memories in the memory index alone, never vector search. */
  @Test
  void aDecisionInAnotherDocumentHoldsAPendingValue() throws Exception {
    ContextMemory rejected =
        memory(
                UUID.randomUUID(),
                "When is the customer billed?",
                "Customers are billed on the 5th of each month.")
            .withEntityStatus(ContextMemoryStatus.REJECTED);
    rankedHits(List.of(rejected));
    eligible(rejected);
    ContextMemory pending =
        memory(
                UUID.randomUUID(),
                rejected.getQuestion(),
                "Customers are billed on the 10th of each month.")
            .withEntityStatus(ContextMemoryStatus.UNPROCESSED);

    assertTrue(
        new SemanticMemoryDuplicateFinder(
                repository, () -> vectorService, () -> searchRepository, completionClient)
            .isHeldByADecision(pending));
    verify(vectorService, never())
        .search(anyString(), any(), anyInt(), anyInt(), anyInt(), anyDouble(), any(), any());
    ArgumentCaptor<String> filter = ArgumentCaptor.forClass(String.class);
    verify(searchClient).searchSimilarContextMemories(anyString(), filter.capture(), eq(20));
    assertTrue(filter.getValue().contains("\"Rejected\""), filter.getValue());
    assertTrue(filter.getValue().contains("\"minimum_should_match\":1"), filter.getValue());
  }

  /** Another year is another fact, whatever a person decided about the first one. */
  @ParameterizedTest
  @EnumSource(
      value = ContextMemoryStatus.class,
      names = {"REJECTED", "SUPERSEDED", "INVALIDATED", "DEPRECATED", "ARCHIVED"})
  void aQuestionForAnotherYearIsAnotherFact(ContextMemoryStatus decided) throws Exception {
    ContextMemory existing =
        memory(UUID.randomUUID(), "What was the VAT rate in 2024?", "20%")
            .withEntityStatus(decided);
    rankedHits(List.of(existing));
    eligible(existing);

    assertEquals(
        new DuplicateMatch.None(),
        keywordFinder()
            .findMatch(memory(UUID.randomUUID(), "What was the VAT rate in 2025?", "20%")));
  }

  /** Re-extraction's pairing: the same question with another figure waits beside a decision. */
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
  void anotherFigureIsHeldOnlyBesideADecision(ContextMemoryStatus stage, boolean held)
      throws Exception {
    ContextMemory existing =
        memory(
                UUID.randomUUID(),
                "When is the customer billed?",
                "Customers are billed on the 5th of each month.")
            .withEntityStatus(stage);
    rankedHits(List.of(existing));
    eligible(existing);

    DuplicateMatch match =
        keywordFinder()
            .findMatch(
                memory(
                    UUID.randomUUID(),
                    existing.getQuestion(),
                    "Customers are billed on the 10th of each month."));

    assertEquals(
        held ? new DuplicateMatch.ConflictsWithDecision(existing) : new DuplicateMatch.None(),
        match);
    verify(completionClient, never()).completeStructured(anyString(), anyString(), any());
  }

  /**
   * A decision in the document being extracted is that document's own rule to apply: the check
   * compares other documents' memories only, so a figure the document rejected holds nothing here.
   */
  @Test
  void aDecisionInTheSameDocumentIsLeftToThatDocument() throws Exception {
    ContextMemory rejected =
        memory(
                UUID.randomUUID(),
                "When is the customer billed?",
                "Customers are billed on the 5th of each month.")
            .withEntityStatus(ContextMemoryStatus.REJECTED);
    rankedHits(List.of(rejected));
    eligible(rejected);
    statedIn(rejected, HANDBOOK);

    assertEquals(
        new DuplicateMatch.None(),
        keywordFinder()
            .findMatch(
                memory(
                    UUID.randomUUID(),
                    rejected.getQuestion(),
                    "Customers are billed on the 10th of each month.")));
  }

  private static final EntityReference PRIVATE_FILE = document("x-private-file");
  private static final EntityReference COPY = document("y-copy");
  private static final EntityReference ORG_WIDE_FILE = document("a-org-wide-file");

  /**
   * A person's unanchored note citing only a private file shows that file: a restricted copy
   * linked to it could be shown in its place, so the copy keeps a memory of its own.
   */
  @Test
  void aRestrictedDocumentNeverJoinsAMemoryShowingAPrivateFile() throws Exception {
    ContextMemory note = noteCiting(PRIVATE_FILE);
    readByEveryone(PRIVATE_FILE, false);
    readByEveryone(COPY, false);

    assertEquals(new DuplicateMatch.None(), checkedFrom(COPY, note));
  }

  /** A document everyone may read joins such a note: it is the one the note then shows. */
  @Test
  void aDocumentEveryoneMayReadJoinsAMemoryShowingAPrivateFile() throws Exception {
    ContextMemory note = noteCiting(PRIVATE_FILE);
    readByEveryone(PRIVATE_FILE, false);

    assertEquals(new DuplicateMatch.Equivalent(note), checkedFrom(COPY, note));
  }

  /** A restricted copy joins a memory anchored to a file everyone may read, which stays shown. */
  @Test
  void aRestrictedDocumentJoinsAMemoryShowingAFileEveryoneMayRead() throws Exception {
    ContextMemory extracted =
        memory(UUID.randomUUID(), "What is churn?", "Churn is the share of customers lost.")
            .withSourceEntity(ORG_WIDE_FILE)
            .withPrimaryEntity(ORG_WIDE_FILE);
    readByEveryone(COPY, false);

    assertEquals(new DuplicateMatch.Equivalent(extracted), checkedFrom(COPY, extracted));
  }

  /**
   * A hold links nothing, so it names no document: a person's note showing a private file still
   * holds a restricted copy's other figure for review, at extraction and at approval alike.
   */
  @Test
  void aDecisionShowingAPrivateFileStillHoldsARestrictedDocumentsOtherFigure() throws Exception {
    ContextMemory note =
        noteCiting(PRIVATE_FILE)
            .withQuestion("When is the customer billed?")
            .withAnswer("Customers are billed on the 5th of each month.");
    readByEveryone(PRIVATE_FILE, false);
    readByEveryone(COPY, false);
    rankedHits(List.of(note));
    eligible(note);
    ContextMemory otherFigure =
        memory(
                UUID.randomUUID(),
                note.getQuestion(),
                "Customers are billed on the 10th of each month.")
            .withSourceEntity(COPY);

    assertEquals(
        new DuplicateMatch.ConflictsWithDecision(note), keywordFinder().findMatch(otherFigure));
    assertTrue(
        keywordFinder()
            .isHeldByADecision(otherFigure.withEntityStatus(ContextMemoryStatus.UNPROCESSED)));
  }

  /** The duplicate check of the same fact, extracted from {@code document}, beside {@code stated}. */
  private DuplicateMatch checkedFrom(EntityReference document, ContextMemory stated)
      throws IOException {
    rankedHits(List.of(stated));
    eligible(stated);
    return keywordFinder()
        .findMatch(
            memory(UUID.randomUUID(), stated.getQuestion(), stated.getAnswer())
                .withSourceEntity(document));
  }

  /** A person's note with no anchor whose only document is {@code cited}. */
  private ContextMemory noteCiting(EntityReference cited) {
    return memory(UUID.randomUUID(), "What is churn?", "Churn is the share of customers lost.")
        .withSourceType(ContextMemorySourceType.MANUAL)
        .withSourceEntity(cited);
  }

  private void readByEveryone(EntityReference document, boolean readable) {
    lenient().when(repository.isReadableByEveryone(document)).thenReturn(readable);
  }

  private static EntityReference document(String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.CONTEXT_FILE)
        .withName(name);
  }

  /** A document's own memory is never its duplicate: its re-extraction matches or keeps both. */
  @Test
  void aMemoryOfTheSameDocumentIsNeverItsDuplicate() throws Exception {
    ContextMemory own =
        memory(UUID.randomUUID(), "What is churn?", "Churn is the share of customers lost.");
    rankedHits(List.of(own));
    eligible(own);
    statedIn(own, HANDBOOK);

    assertEquals(
        new DuplicateMatch.None(),
        keywordFinder().findMatch(memory(UUID.randomUUID(), own.getQuestion(), own.getAnswer())));
  }

  /**
   * Approval holds a value only for a decision in a document that does not state the value: a
   * decision in any document the value shares is that document's rule to apply.
   */
  @Test
  void aDecisionInADocumentTheValueSharesHoldsNothingAtApproval() throws Exception {
    EntityReference copy =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE);
    ContextMemory rejected =
        memory(
                UUID.randomUUID(),
                "When is the customer billed?",
                "Customers are billed on the 5th of each month.")
            .withEntityStatus(ContextMemoryStatus.REJECTED);
    rankedHits(List.of(rejected));
    eligible(rejected);
    ContextMemory pending =
        memory(
                UUID.randomUUID(),
                rejected.getQuestion(),
                "Customers are billed on the 10th of each month.")
            .withEntityStatus(ContextMemoryStatus.UNPROCESSED);
    statedIn(pending, HANDBOOK, copy);
    statedIn(rejected, copy);

    assertFalse(keywordFinder().isHeldByADecision(pending));
  }

  /** A person's note is a decision on a fact only when it cites a file or an article. */
  @ParameterizedTest
  @CsvSource({"table, false", "contextFile, true", "page, true"})
  void aNoteHoldsAnotherFigureOnlyWhenItCitesADocument(String citedType, boolean held)
      throws Exception {
    ContextMemory note =
        memory(
                UUID.randomUUID(),
                "When is the customer billed?",
                "Customers are billed on the 5th of each month.")
            .withSourceType(ContextMemorySourceType.MANUAL)
            .withSourceEntity(new EntityReference().withId(UUID.randomUUID()).withType(citedType));
    rankedHits(List.of(note));
    eligible(note);

    DuplicateMatch match =
        keywordFinder()
            .findMatch(
                memory(
                    UUID.randomUUID(),
                    note.getQuestion(),
                    "Customers are billed on the 10th of each month."));

    assertEquals(
        held ? new DuplicateMatch.ConflictsWithDecision(note) : new DuplicateMatch.None(), match);
  }

  /**
   * Only memories a document states, of the value's scope, take the twenty ranked places: an
   * extracted memory always has its document, a person's note only when the index names its file.
   */
  @Test
  void theLookupRanksOnlyDocumentFactsOfTheValuesScope() throws Exception {
    rankedHits(List.of());

    keywordFinder()
        .findMatch(
            memory(UUID.randomUUID(), "What is churn?", "Customers leave.")
                .withMemoryScope(ContextMemoryScope.ENTITY_SCOPED));
    // memoryScope defaults to EntityScoped, so a value stored without one is an explicit null.
    keywordFinder()
        .findMatch(
            memory(UUID.randomUUID(), "What is churn?", "Customers leave.").withMemoryScope(null));

    ArgumentCaptor<String> filters = ArgumentCaptor.forClass(String.class);
    verify(searchClient, times(2))
        .searchSimilarContextMemories(anyString(), filters.capture(), eq(20));
    List<JsonNode> scoped = filterClauses(filters.getAllValues().get(0));
    List<JsonNode> unscoped = filterClauses(filters.getAllValues().get(1));
    assertTrue(
        scoped.contains(
            JsonUtils.readTree(
                "{\"bool\":{\"minimum_should_match\":1,\"should\":["
                    + "{\"term\":{\"sourceType\":\"FileExtraction\"}},"
                    + "{\"bool\":{\"filter\":[{\"term\":{\"sourceType\":\"Manual\"}},"
                    + "{\"exists\":{\"field\":\"sourceFile.id\"}}]}}]}}")),
        scoped.toString());
    assertTrue(
        scoped.contains(JsonUtils.readTree("{\"term\":{\"memoryScope\":\"EntityScoped\"}}")),
        scoped.toString());
    assertTrue(
        unscoped.contains(
            JsonUtils.readTree(
                "{\"bool\":{\"must_not\":[{\"exists\":{\"field\":\"memoryScope\"}}]}}")),
        "a value stored without a scope matches only memories without one: " + unscoped);
  }

  private static List<JsonNode> filterClauses(String filter) {
    List<JsonNode> clauses = new ArrayList<>();
    JsonUtils.readTree(filter).path("bool").path("filter").forEach(clauses::add);
    return clauses;
  }

  /** The documents a memory is linked to, as the source links name them. */
  private void statedIn(ContextMemory memory, EntityReference... documents) {
    lenient()
        .when(repository.linkedSourceIds(memory.getId()))
        .thenReturn(
            Arrays.stream(documents).map(EntityReference::getId).collect(Collectors.toSet()));
  }

  /** The edit modal saves a correction's text as question and answer; it holds the old figure. */
  @Test
  void anEditModalCorrectionHoldsAnotherDocumentsOldFigure() throws Exception {
    ContextMemory correction =
        memory(UUID.randomUUID(), "The refund window is 45 days", "The refund window is 45 days")
            .withSourceType(ContextMemorySourceType.MANUAL);
    rankedHits(List.of(correction));
    eligible(correction);

    assertEquals(
        new DuplicateMatch.ConflictsWithDecision(correction),
        keywordFinder()
            .findMatch(memory(UUID.randomUUID(), "What is the refund window?", "30 days")));
    verify(completionClient, never()).completeStructured(anyString(), anyString(), any());
  }

  /** Another year is another fact, beside a correction too: the questions' numbers conflict. */
  @Test
  void anEditModalCorrectionForAnotherYearHoldsNothing() throws Exception {
    ContextMemory correction =
        memory(UUID.randomUUID(), "The VAT rate in 2024 is 20%", "The VAT rate in 2024 is 20%")
            .withSourceType(ContextMemorySourceType.MANUAL);
    rankedHits(List.of(correction));
    eligible(correction);

    assertEquals(
        new DuplicateMatch.None(),
        keywordFinder()
            .findMatch(memory(UUID.randomUUID(), "What was the VAT rate in 2025?", "25%")));
  }

  /** The approval check has no judge: a rewording it meets is a new fact, never a failure. */
  @Test
  void theDecisionCheckFinderTreatsARewordingAsANewFact() throws Exception {
    ContextMemory stated =
        memory(UUID.randomUUID(), "What is churn?", "Churn is the share of customers lost.");
    rankedHits(List.of(stated));
    eligible(stated);
    SearchRepository previous = Entity.getSearchRepository();
    Entity.setSearchRepository(searchRepository);
    try {
      assertEquals(
          new DuplicateMatch.None(),
          SemanticMemoryDuplicateFinder.forDecisionChecks(repository)
              .findMatch(
                  memory(
                      UUID.randomUUID(),
                      "Define customer churn",
                      "The portion of customers who leave.")));
    } finally {
      Entity.setSearchRepository(previous);
    }
  }

  /** A hold needs conflicting numbers, so a pending value stating none is never looked up. */
  @Test
  void aPendingValueStatingNoNumberNeedsNoLookup() {
    ContextMemory pending =
        memory(UUID.randomUUID(), "Who owns billing?", "The finance team owns billing.")
            .withEntityStatus(ContextMemoryStatus.UNPROCESSED);

    assertFalse(
        new SemanticMemoryDuplicateFinder(
                repository, () -> vectorService, () -> searchRepository, completionClient)
            .isHeldByADecision(pending));
    verify(searchRepository, never()).getSearchClient();
    verify(vectorService, never())
        .search(anyString(), any(), anyInt(), anyInt(), anyInt(), anyDouble(), any(), any());
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

    ServiceUnavailableException unavailable =
        assertThrows(
            ServiceUnavailableException.class,
            () ->
                finder.findMatch(memory(UUID.randomUUID(), "What is churn?", "Customers leave.")));
    assertEquals(503, unavailable.getResponse().getStatus());
  }

  /** Approval cannot check another document's decisions without the index: a 503, no guess. */
  @Test
  void approvalWithoutAMemoryIndexIsUnavailableRatherThanUnheld() {
    when(searchRepository.getSearchClient()).thenReturn(null);
    ContextMemory pending =
        memory(
                UUID.randomUUID(),
                "When is the customer billed?",
                "Customers are billed on the 10th of each month.")
            .withEntityStatus(ContextMemoryStatus.UNPROCESSED);

    ServiceUnavailableException unavailable =
        assertThrows(
            ServiceUnavailableException.class, () -> keywordFinder().isHeldByADecision(pending));
    assertEquals(503, unavailable.getResponse().getStatus());
  }
}
