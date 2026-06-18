package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheMetrics;
import org.openmetadata.service.cache.CachedSearchLayer;

/**
 * Verifies the search read path streams large responses correctly and the response cache stays
 * consistent — the behaviour added to fix the heap OOM on containers with very large {@code
 * dataModel}s (PR #29191).
 *
 * <p>The search managers now serialize straight to the HTTP output instead of building one giant
 * intermediate String, and {@code SearchResource} buffers a response into a size-capped buffer for
 * caching: small responses are cached, oversized ones (over {@code MAX_CACHEABLE_SEARCH_BYTES} = 4MB)
 * trip the cap and stream uncached. These tests assert the client always receives complete, valid,
 * repeatable JSON across both paths.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class SearchStreamingIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String CONTAINER_INDEX = "container_search_index";

  // Sized so a single container's _source exceeds the 4MB cache cap (~0.3KB per column in the
  // index), forcing the oversized-streaming / cache-bypass path rather than the buffered path.
  private static final int OVER_CAP_COLUMN_COUNT = 20000;
  private static final int SMALL_COLUMN_COUNT = 25;

  @Test
  void largeDataModelSearchStreamsCompleteJson(TestNamespace ns) throws Exception {
    Container container = createContainerWithColumns(ns, "large_dm", OVER_CAP_COLUMN_COUNT);

    String response = awaitContainerSearch(ns, container.getName());

    JsonNode hit = firstSourceFor(response, container.getName());
    assertNotNull(hit, "Large container should be returned by search");
    JsonNode columns = hit.path("dataModel").path("columns");
    assertEquals(
        OVER_CAP_COLUMN_COUNT,
        columns.size(),
        "Streamed response must contain every column with no truncation");
  }

  @Test
  void normalContainerSearchReturnsValidJson(TestNamespace ns) throws Exception {
    Container container = createContainerWithColumns(ns, "small_dm", SMALL_COLUMN_COUNT);

    String response = awaitContainerSearch(ns, container.getName());

    JsonNode root = OBJECT_MAPPER.readTree(response);
    assertTrue(root.has("hits"), "Response should be well-formed search JSON");
    JsonNode hit = firstSourceFor(response, container.getName());
    assertNotNull(hit, "Small container should be returned by search");
    assertEquals(SMALL_COLUMN_COUNT, hit.path("dataModel").path("columns").size());
  }

  @Test
  void repeatedSearchReturnsConsistentResults(TestNamespace ns) throws Exception {
    Container container = createContainerWithColumns(ns, "consistent_dm", SMALL_COLUMN_COUNT);

    String first = awaitContainerSearch(ns, container.getName());
    String second = searchContainer(container.getName());

    // Compare the document body, not the whole envelope (the top-level `took` timing varies per
    // call). A corrupted/truncated cache write — the risk the size-capped buffer guards against —
    // would diverge here whether the second call is served fresh or from cache.
    assertEquals(
        firstSourceFor(first, container.getName()),
        firstSourceFor(second, container.getName()),
        "Repeated identical search must return the same complete document");
  }

  @Test
  void repeatedLargeSearchIsConsistentAcrossTheCacheBypass(TestNamespace ns) throws Exception {
    Container container = createContainerWithColumns(ns, "large_consistent", OVER_CAP_COLUMN_COUNT);

    String first = awaitContainerSearch(ns, container.getName());
    String second = searchContainer(container.getName());

    assertEquals(
        firstSourceFor(first, container.getName()).path("dataModel").path("columns").size(),
        firstSourceFor(second, container.getName()).path("dataModel").path("columns").size(),
        "Oversized response must stream the full column set consistently on every call");
  }

  @Test
  void searchResponseIsCachedWhenCacheEnabled(TestNamespace ns) throws Exception {
    CachedSearchLayer cache = CacheBundle.getCachedSearchLayer();
    Assumptions.assumeTrue(
        cache != null && cache.enabled(), "Search response cache is not enabled on this profile");

    Container container = createContainerWithColumns(ns, "cached_dm", SMALL_COLUMN_COUNT);
    awaitContainerSearch(ns, container.getName()); // first miss populates the cache
    searchContainer(container.getName()); // identical query is served from the cache

    // Streamed responses are buffered into the size-capped tee and cached. If that broke — the
    // regression this fix guards against, where the StreamingOutput entity was never a String the
    // cache could store — the search layer would record zero writes and zero hits forever.
    assertTrue(searchLayerCount("writes") >= 1, "Small search responses must be cached");
    assertTrue(searchLayerCount("hits") >= 1, "Repeated search must be served from the cache");
  }

  private long searchLayerCount(String field) {
    CacheMetrics metrics = CacheMetrics.getInstance();
    long count = 0L;
    if (metrics != null && metrics.snapshot().get("byType") instanceof Map<?, ?> byType) {
      if (byType.get("search") instanceof Map<?, ?> searchStats
          && searchStats.get(field) instanceof Number number) {
        count = number.longValue();
      }
    }
    return count;
  }

  private Container createContainerWithColumns(TestNamespace ns, String baseName, int columnCount) {
    StorageService service = StorageServiceTestFactory.createS3(ns);
    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix(baseName));
    request.setService(service.getFullyQualifiedName());
    request.setDataModel(new ContainerDataModel().withColumns(buildColumns(columnCount)));
    return SdkClients.adminClient().containers().create(request);
  }

  private List<Column> buildColumns(int count) {
    List<Column> columns = new ArrayList<>(count);
    for (int i = 0; i < count; i++) {
      columns.add(
          new Column()
              .withName("col_" + i)
              .withDataType(ColumnDataType.BIGINT)
              .withDescription(
                  "Synthetic column "
                      + i
                      + " padded so the indexed document is large enough to exercise streaming."));
    }
    return columns;
  }

  private String awaitContainerSearch(TestNamespace ns, String name) {
    Awaitility.await()
        .atMost(Duration.ofSeconds(60))
        .pollInterval(1, TimeUnit.SECONDS)
        .until(() -> firstSourceFor(searchContainer(name), name) != null);
    return searchContainer(name);
  }

  private String searchContainer(String name) {
    OpenMetadataClient client = SdkClients.adminClient();
    return client.search().query(name).index(CONTAINER_INDEX).size(10).execute();
  }

  private JsonNode firstSourceFor(String response, String name) throws Exception {
    JsonNode hits = OBJECT_MAPPER.readTree(response).path("hits").path("hits");
    JsonNode match = null;
    for (JsonNode hit : hits) {
      JsonNode source = hit.path("_source");
      if (name.equals(source.path("name").asText())) {
        match = source;
        break;
      }
    }
    return match;
  }
}
