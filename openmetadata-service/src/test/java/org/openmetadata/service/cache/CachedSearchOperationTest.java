package org.openmetadata.service.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.search.SearchRequest;

class CachedSearchOperationTest {
  @Test
  void separatesCountsFromResultsAndPrincipalsButReusesIdenticalCounts() {
    Cache<String, String> values = CacheBuilder.newBuilder().maximumSize(10).build();
    CacheProvider provider = mock(CacheProvider.class);
    when(provider.available()).thenReturn(true);
    when(provider.get(anyString()))
        .thenAnswer(call -> Optional.ofNullable(values.getIfPresent(call.getArgument(0))));
    doAnswer(
            call -> {
              values.put(call.getArgument(0), call.getArgument(1));
              return null;
            })
        .when(provider)
        .set(anyString(), anyString(), any(Duration.class));
    CachedSearchLayer cache =
        new CachedSearchLayer(provider, new CacheKeys("test"), new CacheConfig());
    SearchRequest request = new SearchRequest().withIndex("table").withQuery("customer");
    assertEquals("results", cache.loadOrCompute(request, "admin", () -> "results"));
    assertEquals(
        "counts",
        cache.loadOrCompute(
            request, "admin", CachedSearchLayer.Operation.ENTITY_TYPE_COUNTS, () -> "counts"));
    assertEquals(
        "counts",
        cache.loadOrCompute(
            request,
            "admin",
            CachedSearchLayer.Operation.ENTITY_TYPE_COUNTS,
            () -> {
              throw new AssertionError("Expected count cache hit");
            }));
    assertEquals(
        "restricted",
        cache.loadOrCompute(
            request, "reader", CachedSearchLayer.Operation.ENTITY_TYPE_COUNTS, () -> "restricted"));
    assertEquals(
        "results",
        cache.loadOrCompute(
            request,
            "admin",
            () -> {
              throw new AssertionError("Expected result cache hit");
            }));
  }
}
