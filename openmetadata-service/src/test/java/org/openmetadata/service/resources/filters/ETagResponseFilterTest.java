package org.openmetadata.service.resources.filters;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.util.EntityETag;

class ETagResponseFilterTest {

  private static final int OK = Response.Status.OK.getStatusCode();
  private static final int CREATED = Response.Status.CREATED.getStatusCode();
  private static final int NOT_MODIFIED = Response.Status.NOT_MODIFIED.getStatusCode();

  private final ETagResponseFilter filter = new ETagResponseFilter();

  @Test
  void getResponseGetsETagAndCacheControl() {
    EntityInterface entity = entity(1.2, 111L);
    ContainerResponseContext res = response(OK, entity);

    filter.filter(request("GET", null), res);

    assertEquals(EntityETag.generateETag(entity), res.getHeaders().getFirst(HttpHeaders.ETAG));
    assertEquals("no-store", res.getHeaders().getFirst(HttpHeaders.CACHE_CONTROL));
  }

  @Test
  void mutationResponsesGetETag() {
    EntityInterface entity = entity(2.0, 222L);

    ContainerResponseContext patch = response(OK, entity);
    filter.filter(request("PATCH", null), patch);
    assertEquals(EntityETag.generateETag(entity), patch.getHeaders().getFirst(HttpHeaders.ETAG));

    ContainerResponseContext put = response(OK, entity);
    filter.filter(request("PUT", null), put);
    assertEquals(EntityETag.generateETag(entity), put.getHeaders().getFirst(HttpHeaders.ETAG));

    ContainerResponseContext post = response(CREATED, entity);
    filter.filter(request("POST", null), post);
    assertEquals(EntityETag.generateETag(entity), post.getHeaders().getFirst(HttpHeaders.ETAG));
  }

  @Test
  void getWithMatchingIfNoneMatchBecomes304() {
    EntityInterface entity = entity(3.1, 333L);
    String etag = EntityETag.generateETag(entity);
    ContainerResponseContext res = response(OK, entity);

    filter.filter(request("GET", etag), res);

    verify(res).setStatus(NOT_MODIFIED);
    verify(res).setEntity(null);
  }

  @Test
  void mutationWithMatchingIfNoneMatchIsNotShortCircuited() {
    EntityInterface entity = entity(3.1, 333L);
    String etag = EntityETag.generateETag(entity);
    ContainerResponseContext res = response(OK, entity);

    filter.filter(request("PATCH", etag), res);

    verify(res, never()).setStatus(anyInt());
    assertNotNull(res.getHeaders().getFirst(HttpHeaders.ETAG));
  }

  @Test
  void nonEntityResponseGetsNoETag() {
    ContainerResponseContext res = response(OK, "not-an-entity");

    filter.filter(request("GET", null), res);

    assertNull(res.getHeaders().getFirst(HttpHeaders.ETAG));
  }

  @Test
  void nonSuccessResponseGetsNoETag() {
    EntityInterface entity = entity(1.0, 1L);
    ContainerResponseContext res =
        response(Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(), entity);

    filter.filter(request("GET", null), res);

    assertNull(res.getHeaders().getFirst(HttpHeaders.ETAG));
  }

  private static ContainerRequestContext request(String method, String ifNoneMatch) {
    ContainerRequestContext req = mock(ContainerRequestContext.class);
    when(req.getMethod()).thenReturn(method);
    when(req.getHeaderString(HttpHeaders.IF_NONE_MATCH)).thenReturn(ifNoneMatch);
    return req;
  }

  private static ContainerResponseContext response(int status, Object entity) {
    ContainerResponseContext res = mock(ContainerResponseContext.class);
    MultivaluedMap<String, Object> headers = new MultivaluedHashMap<>();
    when(res.getStatus()).thenReturn(status);
    when(res.getEntity()).thenReturn(entity);
    when(res.getHeaders()).thenReturn(headers);
    return res;
  }

  private static EntityInterface entity(double version, long updatedAt) {
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getVersion()).thenReturn(version);
    when(entity.getUpdatedAt()).thenReturn(updatedAt);
    when(entity.getId()).thenReturn(UUID.randomUUID());
    return entity;
  }
}
