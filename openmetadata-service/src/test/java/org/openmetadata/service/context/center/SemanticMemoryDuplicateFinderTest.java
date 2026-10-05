package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.llm.LLMCompletionClient;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchResultListMapper;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@ExtendWith(MockitoExtension.class)
class SemanticMemoryDuplicateFinderTest {
  /** Every extracted pill is anchored, so an anonymous lookup would never find one. */
  private static final SubjectContext SYSTEM =
      new SubjectContext(
          new User().withId(UUID.randomUUID()).withName("admin").withIsAdmin(true), null);

  @Mock private ContextMemoryRepository repository;
  @Mock private VectorIndexService vectorService;
  @Mock private LLMCompletionClient completionClient;
  @Mock private SearchRepository searchRepository;
  @Mock private SearchClient searchClient;

  private ContextMemory memory(UUID id, String question, String answer) {
    return new ContextMemory()
        .withId(id)
        .withQuestion(question)
        .withAnswer(answer)
        .withSourceType(ContextMemorySourceType.FILE_EXTRACTION)
        .withEntityStatus(EntityStatus.APPROVED)
        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.ENTITY));
  }

  private SemanticMemoryDuplicateFinder finderWithCandidate(ContextMemory candidate) {
    when(vectorService.search(
            anyString(), any(), eq(5), eq(0), eq(20), eq(0.0), isNull(), eq(SYSTEM)))
        .thenReturn(
            new VectorSearchResponse(
                1L, List.of(Map.of("parentId", candidate.getId().toString()))));
    when(repository.get(
            isNull(), eq(candidate.getId()), isNull(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(candidate);
    return new SemanticMemoryDuplicateFinder(
        repository, () -> vectorService, () -> searchRepository, completionClient, () -> SYSTEM);
  }

  @Test
  void identicalFactReusesCandidateWithoutAnotherModelCall() {
    ContextMemory candidate =
        memory(UUID.randomUUID(), "What is churn?", "Churn is the share of customers lost.");
    ContextMemory derived =
        memory(UUID.randomUUID(), " what is churn? ", "Churn is the share of customers lost.");

    assertEquals(candidate, finderWithCandidate(candidate).findEquivalent(derived));
    verify(completionClient, never()).completeStructured(anyString(), anyString(), any());
  }

  @Test
  void identicalLegacyFactWithoutStoredStatusIsReusable() {
    ContextMemory candidate =
        memory(UUID.randomUUID(), "What is churn?", "Churn is the share of customers lost.")
            .withEntityStatus(null);
    ContextMemory derived =
        memory(UUID.randomUUID(), "What is churn?", "Churn is the share of customers lost.");

    assertEquals(candidate, finderWithCandidate(candidate).findEquivalent(derived));
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

    assertEquals(candidate, finderWithCandidate(candidate).findEquivalent(derived));
  }

  @Test
  void relatedButConflictingFactIsNotReused() throws Exception {
    ContextMemory candidate =
        memory(UUID.randomUUID(), "What is the retention window?", "Data is kept for 90 days.");
    ContextMemory derived =
        memory(UUID.randomUUID(), "What is the retention window?", "Data is kept for 30 days.");
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchRepository.getIndexOrAliasName("contextMemory"))
        .thenReturn("context_memory_search_index");
    when(searchClient.searchForExport(any(SearchRequest.class), eq(SYSTEM)))
        .thenReturn(new SearchResultListMapper(List.of(), 0));
    assertNull(finderWithCandidate(candidate).findEquivalent(derived));
    verify(completionClient, never()).completeStructured(anyString(), anyString(), any());
  }

  @Test
  void keywordIndexFindsCandidateWhenVectorSearchFails() throws Exception {
    ContextMemory candidate =
        memory(UUID.randomUUID(), "What is churn?", "Churn is the share of customers lost.");
    when(vectorService.search(
            anyString(), any(), eq(5), eq(0), eq(20), eq(0.0), isNull(), eq(SYSTEM)))
        .thenThrow(new IllegalStateException("vector index unavailable"));
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchRepository.getIndexOrAliasName("contextMemory"))
        .thenReturn("context_memory_search_index");
    when(searchClient.searchForExport(any(SearchRequest.class), eq(SYSTEM)))
        .thenReturn(
            new SearchResultListMapper(List.of(Map.of("id", candidate.getId().toString())), 1));
    when(repository.get(
            isNull(), eq(candidate.getId()), isNull(), eq(Include.NON_DELETED), eq(false)))
        .thenReturn(candidate);

    ContextMemory found =
        new SemanticMemoryDuplicateFinder(
                repository,
                () -> vectorService,
                () -> searchRepository,
                completionClient,
                () -> SYSTEM)
            .findEquivalent(
                memory(UUID.randomUUID(), candidate.getQuestion(), candidate.getAnswer()));

    assertEquals(candidate, found);
    ArgumentCaptor<SearchRequest> request = ArgumentCaptor.forClass(SearchRequest.class);
    verify(searchClient).searchForExport(request.capture(), eq(SYSTEM));
    assertTrue(request.getValue().getQuery().contains("what is churn"));
    assertTrue(request.getValue().getQueryFilter().contains("FileExtraction"));
  }

  @Test
  void unavailableSearchDoesNotCreateAnUncheckedDuplicate() throws Exception {
    when(vectorService.search(
            anyString(), any(), eq(5), eq(0), eq(20), eq(0.0), isNull(), eq(SYSTEM)))
        .thenThrow(new IllegalStateException("vector index unavailable"));
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchRepository.getIndexOrAliasName("contextMemory"))
        .thenReturn("context_memory_search_index");
    when(searchClient.searchForExport(any(SearchRequest.class), eq(SYSTEM)))
        .thenThrow(new IOException("search index unavailable"));
    SemanticMemoryDuplicateFinder finder =
        new SemanticMemoryDuplicateFinder(
            repository,
            () -> vectorService,
            () -> searchRepository,
            completionClient,
            () -> SYSTEM);

    assertThrows(
        IllegalStateException.class,
        () ->
            finder.findEquivalent(memory(UUID.randomUUID(), "What is churn?", "Customers leave.")));
  }
}
