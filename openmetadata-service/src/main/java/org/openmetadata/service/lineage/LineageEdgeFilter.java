package org.openmetadata.service.lineage;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.antlr.v4.runtime.misc.ParseCancellationException;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Which lineage edges a caller wants, judged by the asset each edge leads to: the target of a
 * downstream edge, the source of an upstream one. "Tables only" is about what the lineage reaches,
 * not about the tables it passes through on the way.
 *
 * @param entityTypes keep only edges leading to these entity types; empty keeps all
 * @param excludedEntityTypes drop edges leading to these entity types
 * @param services keep only edges leading into these services; empty keeps all
 */
@Slf4j
public record LineageEdgeFilter(
    Set<String> entityTypes, Set<String> excludedEntityTypes, Set<String> services) {

  public static final LineageEdgeFilter NONE = new LineageEdgeFilter(Set.of(), Set.of(), Set.of());

  /** Lower-cased: entity types are camelCase ids and service names are typed by hand. */
  public LineageEdgeFilter {
    entityTypes = lowerCased(entityTypes);
    excludedEntityTypes = lowerCased(excludedEntityTypes);
    services = lowerCased(services);
  }

  /** REST binds {@code ?entityTypes=table,dashboard} as one value; split it as MCP does. */
  public static LineageEdgeFilter of(
      List<String> entityTypes, List<String> excludedEntityTypes, List<String> services) {
    return new LineageEdgeFilter(
        splitOnCommas(entityTypes), splitOnCommas(excludedEntityTypes), splitOnCommas(services));
  }

  public boolean isActive() {
    return !entityTypes.isEmpty() || !excludedEntityTypes.isEmpty() || !services.isEmpty();
  }

  /**
   * Keeps the edges leading to wanted assets, and only the nodes those edges touch plus the root.
   * Mutates {@code lineage} in place; the repository hands each request its own copy.
   *
   * @return how many distinct edges were removed
   */
  public int apply(EntityLineage lineage) {
    int removed = 0;
    if (isActive()) {
      Map<UUID, EntityReference> nodeIndex = CompactLineageSlimmer.buildNodeIndex(lineage);
      Kept downstream = keep(lineage.getDownstreamEdges(), Edge::getToEntity, nodeIndex);
      Kept upstream = keep(lineage.getUpstreamEdges(), Edge::getFromEntity, nodeIndex);
      lineage.setDownstreamEdges(downstream.edges());
      lineage.setUpstreamEdges(upstream.edges());
      retainTouchedNodes(lineage);
      removed = downstream.removed() + upstream.removed();
    }
    return removed;
  }

  private record Kept(List<Edge> edges, int removed) {}

  private Kept keep(
      List<Edge> edges, Function<Edge, UUID> farEnd, Map<UUID, EntityReference> nodeIndex) {
    Map<Boolean, List<Edge>> byWanted =
        listOrEmpty(edges).stream()
            .collect(
                Collectors.partitioningBy(
                    edge -> leadsToWantedAsset(nodeIndex.get(farEnd.apply(edge)))));
    // distinct(): the repository adds a node's edges again for every path that reaches it.
    int removed = (int) byWanted.get(false).stream().distinct().count();
    return new Kept(new ArrayList<>(byWanted.get(true)), removed);
  }

  private static void retainTouchedNodes(EntityLineage lineage) {
    Set<UUID> touched = ColumnLineageScope.endpointsOf(lineage);
    lineage.setNodes(
        listOrEmpty(lineage.getNodes()).stream()
            .filter(node -> touched.contains(node.getId()))
            .collect(Collectors.toCollection(ArrayList::new)));
  }

  /** The FQN is parsed only for a services filter, so a bad one cannot fail any other filter. */
  private boolean leadsToWantedAsset(EntityReference asset) {
    String type = asset == null ? null : lowerCased(asset.getType());
    String fqn = asset == null ? null : asset.getFullyQualifiedName();
    return isWantedType(type) && (services.isEmpty() || isInWantedService(fqn));
  }

  private boolean isWantedType(String type) {
    boolean included = entityTypes.isEmpty() || (type != null && entityTypes.contains(type));
    boolean excluded = type != null && excludedEntityTypes.contains(type);
    return included && !excluded;
  }

  private boolean isInWantedService(String fqn) {
    String service = serviceOf(fqn);
    return service != null && services.contains(service);
  }

  /**
   * An asset's FQN starts with its service, quoted when the name has dots. A one-segment FQN, like a
   * metric's, names no service, and neither does one that does not parse.
   */
  private static String serviceOf(String fqn) {
    String service = null;
    try {
      String root = fqn == null ? null : FullyQualifiedName.getRoot(fqn);
      service = root == null ? null : lowerCased(FullyQualifiedName.unquoteName(root));
    } catch (ParseCancellationException | IllegalArgumentException e) {
      LOG.debug("Lineage asset FQN '{}' does not parse; it matches no service", fqn, e);
    }
    return service;
  }

  private static String lowerCased(String value) {
    return value == null ? null : value.toLowerCase(Locale.ROOT);
  }

  private static Set<String> lowerCased(Collection<String> values) {
    return values == null
        ? Set.of()
        : values.stream()
            .map(LineageEdgeFilter::lowerCased)
            .collect(Collectors.toUnmodifiableSet());
  }

  private static Set<String> splitOnCommas(List<String> values) {
    return listOrEmpty(values).stream()
        .flatMap(value -> Arrays.stream(value.split(",")))
        .map(String::trim)
        .filter(value -> !value.isEmpty())
        .collect(Collectors.toSet());
  }
}
