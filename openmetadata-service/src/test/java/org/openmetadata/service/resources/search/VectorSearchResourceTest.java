package org.openmetadata.service.resources.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.VectorSearchUnavailableException;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchRequest;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class VectorSearchResourceTest {

  private Authorizer mockAuthorizer;
  private SecurityContext mockSecurityContext;
  private SearchRepository mockSearchRepository;
  private VectorIndexService mockVectorService;
  private VectorSearchResource resource;

  @BeforeEach
  void setUp() {
    mockAuthorizer = mock(Authorizer.class);
    mockSecurityContext = mock(SecurityContext.class);
    mockSearchRepository = mock(SearchRepository.class);
    mockVectorService = mock(VectorIndexService.class);
    resource = new VectorSearchResource(mockAuthorizer);
  }

  @Test
  void testGetFingerprintRequiresAdmin() {
    doThrow(new AuthorizationException("Forbidden"))
        .when(mockAuthorizer)
        .authorizeAdmin(mockSecurityContext);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepository);

      assertThrows(
          AuthorizationException.class,
          () -> resource.getFingerprint(mockSecurityContext, UUID.randomUUID().toString()));

      // Admin authorization is the gate: it must be invoked, and no vector work is done when it
      // fails (the search repository is never consulted for the vector service).
      verify(mockAuthorizer).authorizeAdmin(mockSecurityContext);
      verify(mockSearchRepository, never()).getVectorIndexService();
    }
  }

  @Test
  void testGetFingerprintReturnsFoundWhenFingerprintExists() {
    doNothing().when(mockAuthorizer).authorizeAdmin(mockSecurityContext);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepository);
      when(mockSearchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
      when(mockSearchRepository.getVectorIndexService()).thenReturn(mockVectorService);
      when(mockVectorService.getIndexAlias()).thenReturn("table_search_index");

      String entityId = UUID.randomUUID().toString();
      when(mockVectorService.getExistingFingerprint("table_search_index", entityId))
          .thenReturn("abc123");

      Response response = resource.getFingerprint(mockSecurityContext, entityId);

      assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    }
  }

  @Test
  void testGetFingerprintReturnsNotFoundWhenFingerprintMissing() {
    doNothing().when(mockAuthorizer).authorizeAdmin(mockSecurityContext);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepository);
      when(mockSearchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
      when(mockSearchRepository.getVectorIndexService()).thenReturn(mockVectorService);
      when(mockVectorService.getIndexAlias()).thenReturn("table_search_index");

      String entityId = UUID.randomUUID().toString();
      when(mockVectorService.getExistingFingerprint("table_search_index", entityId))
          .thenReturn(null);

      Response response = resource.getFingerprint(mockSecurityContext, entityId);

      assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    }
  }

  @Test
  void testGetFingerprintReturnsBadRequestForInvalidUuid() {
    doNothing().when(mockAuthorizer).authorizeAdmin(mockSecurityContext);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepository);
      when(mockSearchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
      when(mockSearchRepository.getVectorIndexService()).thenReturn(mockVectorService);

      Response response = resource.getFingerprint(mockSecurityContext, "not-a-uuid");

      assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), response.getStatus());
    }
  }

  @Test
  void testGetFingerprintReturnsBadRequestForMissingParentId() {
    doNothing().when(mockAuthorizer).authorizeAdmin(mockSecurityContext);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepository);
      when(mockSearchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
      when(mockSearchRepository.getVectorIndexService()).thenReturn(mockVectorService);

      Response response = resource.getFingerprint(mockSecurityContext, null);

      assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), response.getStatus());
    }
  }

  @Test
  void testGetFingerprintReturnsServiceUnavailableWhenDisabled() {
    doNothing().when(mockAuthorizer).authorizeAdmin(mockSecurityContext);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepository);
      when(mockSearchRepository.isVectorEmbeddingEnabled()).thenReturn(false);

      Response response =
          resource.getFingerprint(mockSecurityContext, UUID.randomUUID().toString());

      assertEquals(Response.Status.SERVICE_UNAVAILABLE.getStatusCode(), response.getStatus());
    }
  }

  @Test
  void aVectorSearchNoIndexCanServeAnswers503WithTheWayOut() {
    String reindexRequired =
        "Semantic search needs a rebuild of 1 search index, which cannot hold the vectors of the "
            + "configured embedding model model-b (768 dimensions): table_search_index";
    VectorSearchRequest request = new VectorSearchRequest();
    request.query = "customers who stopped buying";

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<DefaultAuthorizer> authorizer = mockStatic(DefaultAuthorizer.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepository);
      authorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(mockSecurityContext))
          .thenReturn(mock(SubjectContext.class));
      when(mockSearchRepository.isVectorEmbeddingEnabled()).thenReturn(true);
      when(mockSearchRepository.getVectorIndexService()).thenReturn(mockVectorService);
      when(mockVectorService.search(
              any(), any(), anyInt(), anyInt(), anyInt(), anyDouble(), any(), any()))
          .thenThrow(new VectorSearchUnavailableException(reindexRequired));

      Response response = resource.vectorSearchPost(mockSecurityContext, request);

      assertEquals(Response.Status.SERVICE_UNAVAILABLE.getStatusCode(), response.getStatus());
      assertEquals(
          reindexRequired,
          JsonUtils.readTree((String) response.getEntity()).path("error").asText());
    }
  }
}
