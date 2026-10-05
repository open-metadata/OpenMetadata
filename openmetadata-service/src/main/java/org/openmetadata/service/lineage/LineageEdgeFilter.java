package org.openmetadata.service.lineage;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.lineage.CompactLineage;
import org.openmetadata.schema.api.lineage.CompactLineageEdge;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Which lineage edges a caller wants, judged by the asset each edge leads to: the target of a
 * downstream edge, the source of an upstream one. "Tables only" is about what the lineage reaches,
 * not about the tables it passes through on the way.
 *
 * @param entityTypes keep only edges leading to these entity types (lower-cased); empty keeps all
 * @param excludedEntityTypes drop edges leading to these entity types (lower-cased)
 * @param services keep only edges leading into these services; empty keeps all
 */
public record LineageEdgeFilter(
    Set<String> entityTypes, Set<String> excludedEntityTypes, Set<String> services) {

  public static final LineageEdgeFilter NONE = new LineageEdgeFilter(Set.of(), Set.of(), Set.of());

  /** The slim graph left after filtering, and how many edges the filter removed. */
  public record Filtered(CompactLineage slim, int removedEdges) {}

  /** Entity types are matched case-insensitively: they are camelCase ids a caller may not case. */
  public static LineageEdgeFilter of(
      List<String> entityTypes, List<String> excludedEntityTypes, List<String> services) {
    return new LineageEdgeFilter(
        lowerCased(entityTypes),
        lowerCased(excludedEntityTypes),
        Set.copyOf(listOrEmpty(services)));
  }

  public boolean isActive() {
    return !entityTypes.isEmpty() || !excludedEntityTypes.isEmpty() || !services.isEmpty();
  }

  /** Mutates {@code slim}'s edge lists; it is the request's own intermediate graph. */
  public Filtered apply(CompactLineage slim) {
    int before = listOrEmpty(slim.getUpstream()).size() + listOrEmpty(slim.getDownstream()).size();
    slim.withUpstream(
            keep(
                slim.getUpstream(),
                CompactLineageEdge::getFromType,
                CompactLineageEdge::getFromFQN))
        .withDownstream(
            keep(
                slim.getDownstream(), CompactLineageEdge::getToType, CompactLineageEdge::getToFQN));
    int after = slim.getUpstream().size() + slim.getDownstream().size();
    return new Filtered(slim, before - after);
  }

  private List<CompactLineageEdge> keep(
      List<CompactLineageEdge> edges,
      Function<CompactLineageEdge, String> farType,
      Function<CompactLineageEdge, String> farFqn) {
    return listOrEmpty(edges).stream()
        .filter(edge -> leadsToWantedAsset(farType.apply(edge), farFqn.apply(edge)))
        .toList();
  }

  private boolean leadsToWantedAsset(String type, String fqn) {
    String lowerType = type == null ? null : type.toLowerCase(Locale.ROOT);
    boolean typeWanted =
        entityTypes.isEmpty() || (lowerType != null && entityTypes.contains(lowerType));
    boolean typeExcluded = lowerType != null && excludedEntityTypes.contains(lowerType);
    String service = serviceOf(fqn);
    boolean serviceWanted = services.isEmpty() || (service != null && services.contains(service));
    return typeWanted && !typeExcluded && serviceWanted;
  }

  /** An asset's FQN starts with its service; a service name with dots is quoted there. */
  private static String serviceOf(String fqn) {
    String service = null;
    if (fqn != null) {
      String root = FullyQualifiedName.getRoot(fqn);
      service = FullyQualifiedName.unquoteName(root == null ? fqn : root);
    }
    return service;
  }

  private static Set<String> lowerCased(List<String> values) {
    return listOrEmpty(values).stream()
        .map(value -> value.toLowerCase(Locale.ROOT))
        .collect(Collectors.toUnmodifiableSet());
  }
}
