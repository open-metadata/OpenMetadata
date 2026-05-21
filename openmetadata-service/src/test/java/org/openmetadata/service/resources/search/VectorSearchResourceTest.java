package org.openmetadata.service.resources.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
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
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;

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
      when(mockSearchRepository.isVectorEmbeddingEnabled()).thenReturn(true);

      try {
        resource.getFingerprint(mockSecurityContext, UUID.randomUUID().toString());
      } catch (AuthorizationException e) {
        verify(mockVectorService, never()).getExistingFingerprint(any(), any());
        return;
      }
      throw new AssertionError("Expected AuthorizationException");
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
}
