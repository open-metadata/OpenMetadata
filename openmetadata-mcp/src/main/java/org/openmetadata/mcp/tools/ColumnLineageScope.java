package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.service.lineage.LineageGraphPruner;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Narrows a table-level lineage graph to the lineage of one column.
 *
 * <p>The repository walks lineage table by table, so a busy table's graph holds every consumer of
 * every column and the one column asked about is lost in it. Column mappings name both ends by FQN
 * ({@code fromColumns -> toColumn}), so the column can be followed hop by hop - including where a
 * consumer renames it - over the graph already fetched: keep the mappings that carry a column
 * already reached, then drop the edges and tables left with none.
 */
final class ColumnLineageScope {

  private ColumnLineageScope() {}

  static String requireColumnOf(String entityFqn, String columnFqn) {
    if (!FullyQualifiedName.isParent(columnFqn, entityFqn)) {
      throw new IllegalArgumentException(
          String.format("Column '%s' is not a column of '%s'", columnFqn, entityFqn));
    }
    return columnFqn;
  }

  /** Mutates {@code lineage} in place; the repository hands each request its own copy. */
  static void narrow(EntityLineage lineage, String columnFqn) {
    lineage.setDownstreamEdges(
        follow(lineage.getDownstreamEdges(), columnFqn, Direction.DOWNSTREAM));
    lineage.setUpstreamEdges(follow(lineage.getUpstreamEdges(), columnFqn, Direction.UPSTREAM));
    LineageGraphPruner.retainReachable(lineage, endpointsOf(lineage));
  }

  private static List<Edge> follow(List<Edge> edges, String columnFqn, Direction direction) {
    Set<String> reached = reachedColumns(edges, columnFqn, direction);
    List<Edge> kept = new ArrayList<>();
    for (Edge edge : listOrEmpty(edges)) {
      List<ColumnLineage> carried =
          mappingsOf(edge).stream().filter(mapping -> direction.carries(mapping, reached)).toList();
      if (!carried.isEmpty()) {
        edge.getLineageDetails().setColumnsLineage(new ArrayList<>(carried));
        kept.add(edge);
      }
    }
    return kept;
  }

  /**
   * Repeats until nothing new is reached: edges come back depth-first with no ORDER BY, so a hop
   * can be listed before the hop that reaches it.
   */
  private static Set<String> reachedColumns(
      List<Edge> edges, String columnFqn, Direction direction) {
    List<ColumnLineage> mappings =
        listOrEmpty(edges).stream().flatMap(edge -> mappingsOf(edge).stream()).toList();
    Set<String> reached = new HashSet<>(Set.of(columnFqn));
    int before;
    do {
      before = reached.size();
      mappings.stream()
          .filter(mapping -> direction.carries(mapping, reached))
          .forEach(mapping -> reached.addAll(direction.next(mapping)));
    } while (reached.size() > before);
    return reached;
  }

  private static List<ColumnLineage> mappingsOf(Edge edge) {
    return edge.getLineageDetails() == null
        ? List.of()
        : listOrEmpty(edge.getLineageDetails().getColumnsLineage());
  }

  private static Set<UUID> endpointsOf(EntityLineage lineage) {
    Set<UUID> endpoints = new HashSet<>(Set.of(lineage.getEntity().getId()));
    Stream.concat(
            listOrEmpty(lineage.getUpstreamEdges()).stream(),
            listOrEmpty(lineage.getDownstreamEdges()).stream())
        .forEach(
            edge -> {
              endpoints.add(edge.getFromEntity());
              endpoints.add(edge.getToEntity());
            });
    return endpoints;
  }

  /**
   * A mapping's {@code fromColumns} belong to the edge's from-side table and {@code toColumn} to its
   * to-side, in both edge lists. So downstream the column travels from-to, and upstream to-from.
   */
  private enum Direction {
    DOWNSTREAM {
      @Override
      boolean carries(ColumnLineage mapping, Set<String> reached) {
        return listOrEmpty(mapping.getFromColumns()).stream().anyMatch(reached::contains);
      }

      @Override
      List<String> next(ColumnLineage mapping) {
        return mapping.getToColumn() == null ? List.of() : List.of(mapping.getToColumn());
      }
    },
    UPSTREAM {
      @Override
      boolean carries(ColumnLineage mapping, Set<String> reached) {
        return reached.contains(mapping.getToColumn());
      }

      @Override
      List<String> next(ColumnLineage mapping) {
        return listOrEmpty(mapping.getFromColumns());
      }
    };

    abstract boolean carries(ColumnLineage mapping, Set<String> reached);

    abstract List<String> next(ColumnLineage mapping);
  }
}
