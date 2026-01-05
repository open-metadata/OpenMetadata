package org.openmetadata.service.search.lineage;

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
        request.getIsConnectedVia() != null ? request.getIsConnectedVia() : Boolean.FALSE);
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
        "LineageCacheKey{fqn='%s', up=%d, down=%d, queryFilter='%s', columnFilter='%s', preservePaths=%b}",
        fqn, upstreamDepth, downstreamDepth, queryFilter, columnFilter, preservePaths);
  }
}
