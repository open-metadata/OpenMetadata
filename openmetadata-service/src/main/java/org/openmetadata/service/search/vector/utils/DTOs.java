package org.openmetadata.service.search.vector.utils;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

public final class DTOs {
  private DTOs() {}

  @Data
  @NoArgsConstructor
  @AllArgsConstructor
  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class VectorSearchRequest {
    public String query = "";
    public Map<String, List<String>> filters = Map.of();
    public int size = 10;
    public Integer from = 0;
    public int k = 1_000;

    @JsonAlias("min_score")
    public double threshold = 0.0;
  }

  @Data
  @NoArgsConstructor
  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class VectorSearchResponse {
    public long tookMillis;
    public List<Map<String, Object>> hits;

    // Total raw hits returned by OpenSearch before parent-level grouping.
    public Long totalHits;

    // Indicates whether additional parent groups may be available after this page.
    public Boolean hasMore;

    public VectorSearchResponse(long tookMillis, List<Map<String, Object>> hits) {
      this(tookMillis, hits, null, null);
    }

    public VectorSearchResponse(
        long tookMillis, List<Map<String, Object>> hits, Long totalHits, Boolean hasMore) {
      this.tookMillis = tookMillis;
      this.hits = hits;
      this.totalHits = totalHits;
      this.hasMore = hasMore;
    }
  }

  @Data
  @NoArgsConstructor
  @AllArgsConstructor
  @JsonIgnoreProperties(ignoreUnknown = true)
  public static class FingerprintResponse {
    public String parentId;
    public String indexName;
    public String fingerprint;
    public String message;
  }
}
