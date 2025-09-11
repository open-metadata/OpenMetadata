package org.openmetadata.service.resources.system;

import static org.junit.jupiter.api.Assertions.*;

import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class CacheResourceTest {

  private CacheResource cacheResource;

  @BeforeEach
  void setUp() {
    // Create with null CacheBundle since our mock implementation doesn't use it
    cacheResource = new CacheResource(null);
  }

  @Test
  void testGetCacheStats() {
    Response response = cacheResource.getCacheStats();

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    assertNotNull(response.getEntity());
    String stats = (String) response.getEntity();
    assertTrue(stats.contains("redis"));
    assertTrue(stats.contains("available"));
  }

  @Test
  void testTriggerWarmupWithoutForce() {
    Response response = cacheResource.triggerWarmup(false);

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    String result = (String) response.getEntity();
    assertTrue(result.contains("Cache warmup triggered"));
    assertTrue(result.contains("\"force\": false"));
  }

  @Test
  void testTriggerWarmupWithForce() {
    Response response = cacheResource.triggerWarmup(true);

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    String result = (String) response.getEntity();
    assertTrue(result.contains("Cache warmup triggered"));
    assertTrue(result.contains("\"force\": true"));
  }

  @Test
  void testInvalidateAll() {
    Response response = cacheResource.invalidateAll();

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    String result = (String) response.getEntity();
    assertTrue(result.contains("Cache invalidated"));
  }

  @Test
  void testClearCache() {
    Response response = cacheResource.clearCache();

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    String result = (String) response.getEntity();
    assertTrue(result.contains("Cache cleared"));
  }
}
