package org.openmetadata.service.search.lineage;

import java.util.Set;
import lombok.EqualsAndHashCode;
import lombok.Value;
import org.openmetadata.schema.api.lineage.SearchLineageRequest;

/**
 * Immutable cache key for lineage graph results.
 * All fields that affect the lineage result must be included in the key.
 *
 * <p>Uses Lombok @Value for:
 * - Immutability (all fields final)
 * - Automatic equals() and hashCode() implementation
 * - Automatic toString() for debugging
 *
 * <p>Cache key includes:
 * - Entity FQN (root of lineage graph)
 * - Upstream/downstream depth (affects graph size)
 * - Query filters (affects which nodes are included)
 * - Column filters (affects column-level lineage)
 * - Path preservation flag (affects intermediate nodes)
 * - Direction and connection filters
 * - Pagination parameters (from, size) for entity count queries
 * - Node depth filter for entity count queries
 * - Edge time window (startTime, endTime in epoch millis) so windowed lineage
 *   queries occupy distinct cache slots
 * - Layer pagination (layerFrom, layerSize) so paginated lineage queries occupy
 *   distinct cache slots
 * - Include-deleted flag so queries with different deleted-entity visibility
 *   occupy distinct cache slots
 * - Include-source-fields so queries requesting different node payload fields
 *   occupy distinct cache slots
 */
@Value
@EqualsAndHashCode
public class LineageCacheKey {

  String fqn;
  int upstreamDepth;
  int downstreamDepth;
  String queryFilter;
  String columnFilter;
  Boolean preservePaths;
  String direction;
  Boolean isConnectedVia;
  int from;
  int size;
  int nodeDepth;
  Boolean includePaginationInfo;
  int paginationUpstreamDepth;
  int paginationDownstreamDepth;
  Long startTime;
  Long endTime;
  int layerFrom;
  int layerSize;
  Boolean includeDeleted;
  Set<String> includeSourceFields;

  /**
   * Creates cache key from lineage request.
   * Normalizes null values to empty strings for consistent hashing.
   *
   * @param request The lineage request
   * @return Cache key representing the request
   */
  public static LineageCacheKey fromRequest(SearchLineageRequest request) {
    if (request == null) {
      throw new IllegalArgumentException("SearchLineageRequest cannot be null");
    }

    return new LineageCacheKey(
        request.getFqn() != null ? request.getFqn() : "",
        request.getUpstreamDepth() != null ? request.getUpstreamDepth() : 0,
        request.getDownstreamDepth() != null ? request.getDownstreamDepth() : 0,
        request.getQueryFilter() != null ? request.getQueryFilter() : "",
        request.getColumnFilter() != null ? request.getColumnFilter() : "",
        request.getPreservePaths() != null ? request.getPreservePaths() : Boolean.TRUE,
        request.getDirection() != null ? request.getDirection().value() : "",
        request.getIsConnectedVia() != null ? request.getIsConnectedVia() : Boolean.FALSE,
        0,
        0,
        0,
        Boolean.FALSE,
        0,
        0,
        request.getStartTime(),
        request.getEndTime(),
        request.getLayerFrom() != null ? request.getLayerFrom() : 0,
        request.getLayerSize() != null ? request.getLayerSize() : 0,
        request.getIncludeDeleted(),
        request.getIncludeSourceFields() != null ? request.getIncludeSourceFields() : Set.of());
  }

  /**
   * Gets a human-readable representation of the cache key.
   * Useful for logging and debugging cache behavior.
   *
   * @return String representation
   */
  @Override
  public String toString() {
    return String.format(
        "LineageCacheKey{fqn='%s', up=%d, down=%d, queryFilter='%s', columnFilter='%s',"
            + " preservePaths=%b, direction='%s', isConnectedVia=%b, from=%d, size=%d,"
            + " nodeDepth=%d, includePaginationInfo=%b, paginationUpstreamDepth=%d,"
            + " paginationDownstreamDepth=%d, startTime=%s, endTime=%s, layerFrom=%d,"
            + " layerSize=%d, includeDeleted=%s, includeSourceFields=%s}",
        fqn,
        upstreamDepth,
        downstreamDepth,
        queryFilter,
        columnFilter,
        preservePaths,
        direction,
        isConnectedVia,
        from,
        size,
        nodeDepth,
        includePaginationInfo,
        paginationUpstreamDepth,
        paginationDownstreamDepth,
        startTime,
        endTime,
        layerFrom,
        layerSize,
        includeDeleted,
        includeSourceFields);
  }
}
