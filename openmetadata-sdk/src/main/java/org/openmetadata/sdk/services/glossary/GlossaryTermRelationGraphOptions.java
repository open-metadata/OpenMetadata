package org.openmetadata.sdk.services.glossary;

import java.util.List;

/** Bounds and filters applied when loading a glossary-term relation graph. */
public record GlossaryTermRelationGraphOptions(
    int depth, List<String> relationTypes, int nodeLimit, int edgeLimit) {
  private static final int DEFAULT_NODE_LIMIT = 500;
  private static final int DEFAULT_EDGE_LIMIT = 1000;

  public GlossaryTermRelationGraphOptions {
    requireRange("depth", depth, 1, 5);
    requireRange("nodeLimit", nodeLimit, 1, 5000);
    requireRange("edgeLimit", edgeLimit, 1, 10000);
    relationTypes = relationTypes == null ? List.of() : List.copyOf(relationTypes);
  }

  public static GlossaryTermRelationGraphOptions defaults(
      final int depth, final List<String> relationTypes) {
    return new GlossaryTermRelationGraphOptions(
        depth, relationTypes, DEFAULT_NODE_LIMIT, DEFAULT_EDGE_LIMIT);
  }

  private static void requireRange(
      final String field, final int value, final int minimum, final int maximum) {
    if (value < minimum || value > maximum) {
      throw new IllegalArgumentException(
          "%s must be between %d and %d".formatted(field, minimum, maximum));
    }
  }
}
