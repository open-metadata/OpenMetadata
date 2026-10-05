package org.openmetadata.service.lineage;

import lombok.Builder;

/**
 * What one compact-lineage page should hold. Transports validate and default their own inputs
 * (MCP params, REST query params) and hand the service this one shape.
 *
 * @param column FQN of one column of the entity to narrow the graph to, or {@code null}
 * @param from offset of the first edge to return
 * @param limit most edges to return; the size budget may return fewer
 * @param maxResponseChars serialized size the caller's response must stay under
 * @param edgeFilter which edges to keep, by the asset each leads to; {@link LineageEdgeFilter#NONE}
 *     keeps all
 */
@Builder
public record CompactLineageRequest(
    String entityType,
    String fqn,
    int upstreamDepth,
    int downstreamDepth,
    String column,
    boolean includeColumnLineage,
    boolean includeSql,
    int from,
    int limit,
    int maxResponseChars,
    LineageEdgeFilter edgeFilter) {

  /**
   * REST binds an empty {@code ?column=} as "" where MCP drops it; both mean "no column". A builder
   * that never sets a filter leaves it null, which means no filter.
   */
  public CompactLineageRequest {
    column = column == null || column.isBlank() ? null : column;
    edgeFilter = edgeFilter == null ? LineageEdgeFilter.NONE : edgeFilter;
  }

  /** A column-scoped graph is column lineage by definition, so its mappings always come back. */
  CompactLineageSlimmer.EdgeOptions edgeOptions() {
    return new CompactLineageSlimmer.EdgeOptions(
        column != null || includeColumnLineage, includeSql);
  }
}
