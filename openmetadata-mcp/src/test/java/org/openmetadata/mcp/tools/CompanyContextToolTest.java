package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.security.Principal;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.mcp.util.PageCursor;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemorySharedPrincipal;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@ExtendWith(MockitoExtension.class)
class CompanyContextToolTest {

  private final CompanyContextTool tool = new CompanyContextTool();
  private MockedStatic<Entity> entityMock;

  @BeforeEach
  void setUp() {
    entityMock = mockStatic(Entity.class);
    entityMock
        .when(() -> Entity.getEntityRepository(Entity.CONTEXT_MEMORY))
        .thenReturn(mock(ContextMemoryRepository.class));
  }

  @AfterEach
  void tearDown() {
    entityMock.close();
  }

  @Test
  void missingQueryAndFqnReturnsError() throws Exception {
    Map<String, Object> result =
        tool.execute(mock(Authorizer.class), mock(CatalogSecurityContext.class), new HashMap<>());

    assertTrue(
        result.get("error").toString().contains("not both and not neither"),
        result.get("error").toString());
    assertEquals(0, result.get("returnedCount"));
  }

  @Test
  void blankQueryReturnsError() throws Exception {
    Map<String, Object> params = new HashMap<>();
    params.put("query", "   ");

    Map<String, Object> result =
        tool.execute(mock(Authorizer.class), mock(CatalogSecurityContext.class), params);

    assertTrue(
        result.get("error").toString().contains("not both and not neither"),
        result.get("error").toString());
  }

  @Test
  void cursorThreadsOffsetIntoVectorSearchClosingThePagingGap() throws Exception {
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
    entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

    OpenSearchVectorService vectorService = mock(OpenSearchVectorService.class);
    VectorSearchResponse response = new VectorSearchResponse(5L, Collections.emptyList());

    try (MockedStatic<OpenSearchVectorService> vectorMock =
            mockStatic(OpenSearchVectorService.class);
        MockedStatic<DefaultAuthorizer> authorizerMock = mockStatic(DefaultAuthorizer.class)) {
      vectorMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);
      authorizerMock
          .when(() -> DefaultAuthorizer.getSubjectContext(any()))
          .thenReturn(mock(SubjectContext.class));
      ArgumentCaptor<Integer> fromCaptor = ArgumentCaptor.forClass(Integer.class);
      when(vectorService.search(
              anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble(), any(), any()))
          .thenReturn(response);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "refund policy");
      params.put("cursor", PageCursor.encodeOffset(40));

      tool.execute(mock(Authorizer.class), mock(CatalogSecurityContext.class), params);

      verify(vectorService)
          .search(
              anyString(),
              anyMap(),
              anyInt(),
              fromCaptor.capture(),
              anyInt(),
              anyDouble(),
              any(),
              any());
      assertEquals(40, fromCaptor.getValue());
    }
  }

  @Test
  void aFieldThePillDoesNotHaveIsOmittedByBothLookups() throws Exception {
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
    entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

    Map<String, Object> hit = new HashMap<>();
    hit.put("name", "refunds");
    hit.put("fullyQualifiedName", "refunds");
    hit.put("answer", "Within 30 days.");
    hit.put("summary", null);
    OpenSearchVectorService vectorService = mock(OpenSearchVectorService.class);
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);

    try (MockedStatic<OpenSearchVectorService> vectorMock =
            mockStatic(OpenSearchVectorService.class);
        MockedStatic<DefaultAuthorizer> authorizerMock = mockStatic(DefaultAuthorizer.class)) {
      vectorMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);
      authorizerMock
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(mock(SubjectContext.class));
      when(vectorService.search(
              anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble(), any(), any()))
          .thenReturn(new VectorSearchResponse(1L, List.of(hit)));

      Map<String, Object> params = new HashMap<>();
      params.put("query", "refund policy");
      Map<String, Object> result = tool.execute(mock(Authorizer.class), securityContext, params);

      @SuppressWarnings("unchecked")
      List<Map<String, Object>> pills = (List<Map<String, Object>>) result.get("results");
      // The by-name half already skipped absent fields; the search half emitted them as explicit
      // nulls, so one pill looked different depending on how it was fetched. One tool, one rule.
      assertTrue(
          !pills.get(0).containsKey("summary"),
          "a null field must be left out, not returned as null: " + pills.get(0));
      assertEquals("Within 30 days.", pills.get(0).get("answer"));
    }
  }

  @Test
  void searchIsScopedToPillsAndCarriesTheCallersIdentity() throws Exception {
    SearchRepository searchRepository = mock(SearchRepository.class);
    when(searchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
    entityMock.when(Entity::getSearchRepository).thenReturn(searchRepository);

    OpenSearchVectorService vectorService = mock(OpenSearchVectorService.class);
    VectorSearchResponse response = new VectorSearchResponse(0L, Collections.emptyList());
    SubjectContext subjectContext = mock(SubjectContext.class);
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);

    try (MockedStatic<OpenSearchVectorService> vectorMock =
            mockStatic(OpenSearchVectorService.class);
        MockedStatic<DefaultAuthorizer> authorizerMock = mockStatic(DefaultAuthorizer.class)) {
      vectorMock.when(OpenSearchVectorService::getInstance).thenReturn(vectorService);
      authorizerMock
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(subjectContext);
      when(vectorService.search(
              anyString(), anyMap(), anyInt(), anyInt(), anyInt(), anyDouble(), any(), any()))
          .thenReturn(response);

      Map<String, Object> params = new HashMap<>();
      params.put("query", "refund policy");

      tool.execute(mock(Authorizer.class), securityContext, params);

      ArgumentCaptor<Map<String, List<String>>> filters = ArgumentCaptor.forClass(Map.class);
      ArgumentCaptor<SubjectContext> subject = ArgumentCaptor.forClass(SubjectContext.class);
      verify(vectorService)
          .search(
              anyString(),
              filters.capture(),
              anyInt(),
              anyInt(),
              anyInt(),
              anyDouble(),
              any(),
              subject.capture());

      assertEquals(subjectContext, subject.getValue());
      assertEquals(List.of("FileExtraction"), filters.getValue().get("sourceType"));
      assertEquals(List.of("Shared"), filters.getValue().get("visibility"));
    }
  }

  @Test
  void deniedAuthorizationPropagates() {
    Authorizer authorizer = mock(Authorizer.class);
    doThrow(new AuthorizationException("denied")).when(authorizer).authorize(any(), any(), any());

    assertThrows(
        AuthorizationException.class,
        () ->
            tool.execute(
                authorizer, mock(CatalogSecurityContext.class), Map.of("query", "refund policy")));
  }

  @Test
  void neitherQueryNorFqnIsRejected() throws Exception {
    Map<String, Object> result =
        tool.execute(mock(Authorizer.class), mock(CatalogSecurityContext.class), new HashMap<>());

    assertTrue(
        result.get("error").toString().contains("not both and not neither"),
        result.get("error").toString());
  }

  @Test
  void aBlankFqnIsRejected() throws Exception {
    Map<String, Object> params = new HashMap<>();
    params.put("fqn", "   ");

    Map<String, Object> result =
        tool.execute(mock(Authorizer.class), mock(CatalogSecurityContext.class), params);

    assertTrue(
        result.get("error").toString().contains("not both and not neither"),
        result.get("error").toString());
  }

  @Test
  void deniedAuthorizationPropagatesOnLookup() {
    Authorizer authorizer = mock(Authorizer.class);
    doThrow(new AuthorizationException("denied")).when(authorizer).authorize(any(), any(), any());

    assertThrows(
        AuthorizationException.class,
        () -> tool.execute(authorizer, mock(CatalogSecurityContext.class), Map.of("fqn", "x")));
  }

  @Test
  void sharedFilePillIsProjectedToAPrincipalItIsSharedWith() throws Exception {
    stubMemory(
        "pill-fqn",
        sharedWith(
            memory("pill-fqn", ContextMemorySourceType.FILE_EXTRACTION, MemoryVisibility.SHARED),
            "bob"));
    CatalogSecurityContext securityContext = securityContextFor("bob");

    Map<String, Object> result =
        withSubject(
            securityContext,
            "bob",
            () -> tool.execute(mock(Authorizer.class), securityContext, Map.of("fqn", "pill-fqn")));

    assertEquals("Q", result.get("question"));
    assertEquals("A", result.get("answer"));
  }

  /**
   * Shared means shared with someone: the pill's own shareConfig names the principals, and the
   * search half of this tool already filters on them. Reading by name must answer the same
   * question, or one lookup exposes what the other hides.
   */
  @Test
  void sharedFilePillIsWithheldFromAPrincipalItIsNotSharedWith() throws Exception {
    stubMemory(
        "pill-fqn",
        sharedWith(
            memory("pill-fqn", ContextMemorySourceType.FILE_EXTRACTION, MemoryVisibility.SHARED),
            "alice"));
    CatalogSecurityContext securityContext = securityContextFor("bob");

    Map<String, Object> result =
        withSubject(
            securityContext,
            "bob",
            () -> tool.execute(mock(Authorizer.class), securityContext, Map.of("fqn", "pill-fqn")));

    assertEquals(
        "Requested entity is not a shared Company Context knowledge pill", result.get("error"));
    assertFalse(result.containsKey("answer"), "the pill body must not be returned: " + result);
  }

  @Test
  void unquotedDottedFqnResolvesToQuotedPill() throws Exception {
    stubMemory(
        "\"report.md_hash\"",
        sharedWith(
            memory(
                "report.md_hash", ContextMemorySourceType.FILE_EXTRACTION, MemoryVisibility.SHARED),
            "bob"));

    CatalogSecurityContext securityContext = securityContextFor("bob");
    Map<String, Object> result =
        withSubject(
            securityContext,
            "bob",
            () ->
                tool.execute(
                    mock(Authorizer.class), securityContext, Map.of("fqn", "report.md_hash")));

    assertEquals("Q", result.get("question"));
    assertEquals("A", result.get("answer"));
  }

  @Test
  void missingPillReturnsErrorInsteadOfThrowing() throws Exception {
    entityMock
        .when(
            () ->
                Entity.getEntityByName(
                    eq(Entity.CONTEXT_MEMORY), anyString(), anyString(), isNull()))
        .thenThrow(new EntityNotFoundException("contextMemory instance for ghost not found"));

    Map<String, Object> result =
        tool.execute(
            mock(Authorizer.class), mock(CatalogSecurityContext.class), Map.of("fqn", "ghost"));

    assertEquals("No Company Context knowledge pill found for 'ghost'", result.get("error"));
  }

  @Test
  void nonFileMemoryReturnsError() throws Exception {
    stubMemory(
        "chat-fqn",
        memory("chat-fqn", ContextMemorySourceType.CHAT_PROMOTION, MemoryVisibility.SHARED));

    Map<String, Object> result =
        tool.execute(
            mock(Authorizer.class), mock(CatalogSecurityContext.class), Map.of("fqn", "chat-fqn"));

    assertEquals(
        "Requested entity is not a shared Company Context knowledge pill", result.get("error"));
  }

  @Test
  void privateFilePillReturnsError() throws Exception {
    stubMemory(
        "private-fqn",
        memory("private-fqn", ContextMemorySourceType.FILE_EXTRACTION, MemoryVisibility.PRIVATE));

    Map<String, Object> result =
        tool.execute(
            mock(Authorizer.class),
            mock(CatalogSecurityContext.class),
            Map.of("fqn", "private-fqn"));

    assertEquals(
        "Requested entity is not a shared Company Context knowledge pill", result.get("error"));
  }

  private void stubMemory(String fqn, ContextMemory memory) {
    entityMock
        .when(
            () -> Entity.getEntityByName(eq(Entity.CONTEXT_MEMORY), eq(fqn), anyString(), isNull()))
        .thenReturn(memory);
  }

  private ContextMemory sharedWith(ContextMemory memory, String userName) {
    memory
        .getShareConfig()
        .withSharedWith(
            List.of(
                new MemorySharedPrincipal()
                    .withPrincipal(
                        new EntityReference()
                            .withType(Entity.USER)
                            .withName(userName)
                            .withFullyQualifiedName(userName))));
    return memory;
  }

  private CatalogSecurityContext securityContextFor(String userName) {
    Principal principal = mock(Principal.class);
    when(principal.getName()).thenReturn(userName);
    CatalogSecurityContext securityContext = mock(CatalogSecurityContext.class);
    when(securityContext.getUserPrincipal()).thenReturn(principal);
    return securityContext;
  }

  private <T> T withSubject(
      CatalogSecurityContext securityContext, String userName, Callable<T> body) throws Exception {
    try (MockedStatic<DefaultAuthorizer> subjects = mockStatic(DefaultAuthorizer.class)) {
      subjects
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(new SubjectContext(new User().withName(userName), null, null));
      return body.call();
    }
  }

  private ContextMemory memory(
      String fqn, ContextMemorySourceType sourceType, MemoryVisibility visibility) {
    return new ContextMemory()
        .withName(fqn)
        .withFullyQualifiedName(fqn)
        .withQuestion("Q")
        .withAnswer("A")
        .withSourceType(sourceType)
        .withShareConfig(new MemoryShareConfig().withVisibility(visibility));
  }

  @Test
  void passingBothKeysIsRejectedRatherThanGuessed() throws Exception {
    Map<String, Object> params = new HashMap<>();
    params.put("query", "what is churn");
    params.put("fqn", "some_pill");

    Map<String, Object> result =
        tool.execute(mock(Authorizer.class), mock(CatalogSecurityContext.class), params);

    // The two tools this replaced took one key each. Silently preferring one would make the other
    // argument vanish with no way for the caller to tell which lookup actually ran.
    assertEquals(0, result.get("returnedCount"));
    assertTrue(result.get("error").toString().contains("not both"), result.get("error").toString());
  }
}
