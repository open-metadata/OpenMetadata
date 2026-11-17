package org.openmetadata.service.ontology;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.rdf.RdfGraphService.GraphRequest;
import org.openmetadata.service.security.AuthorizationException;

/**
 * Adds a root entity's concept bindings to its explore graph. Bindings are not projected into RDF
 * (ADR:2026-10-19-native-concept-bindings-remain-operational-metadata), so each request reads them
 * from SQL with the caller's permissions, after the graph cache, and they are never stale. The edge
 * runs concept to asset under the predicate the release export writes, {@code om:boundAsset}.
 */
public final class OntologyBindingGraphLinks {
  public static final String BOUND_ASSET = "boundAsset";
  static final int MAX_ASSETS = OntologyConceptBindingService.MAX_PAGE_SIZE;

  private final OntologyConceptBindingService bindings;

  public OntologyBindingGraphLinks(final OntologyConceptBindingService bindings) {
    this.bindings = bindings;
  }

  record Link(EntityReference concept, EntityReference asset) {}

  record Links(List<Link> links, boolean truncated) {}

  public String merge(
      final String graphJson,
      final String baseUri,
      final GraphRequest request,
      final OntologyConceptBindingService.Access access) {
    if (request.depth() == 0 || !wanted(request.relationshipTypes())) {
      return graphJson;
    }
    final var root =
        new EntityReference().withType(request.entityType()).withId(request.entityId());
    try {
      return withLinks(graphJson, baseUri, links(root, access), request.entityTypes());
    } catch (final EntityNotFoundException | AuthorizationException unavailable) {
      return graphJson;
    }
  }

  private Links links(
      final EntityReference root, final OntologyConceptBindingService.Access access) {
    if (Entity.ONTOLOGY_CONCEPT.equals(root.getType())) {
      return assetsOf(root, access);
    }
    if (!bindable(root.getType())) {
      return new Links(List.of(), false);
    }
    final var links =
        bindings.linksForAsset(access, root.getType(), root.getId()).getLinks().stream()
            .map(link -> new Link(link.getConcept(), root))
            .toList();
    return capped(links);
  }

  private Links assetsOf(
      final EntityReference concept, final OntologyConceptBindingService.Access access) {
    final List<Link> links = new ArrayList<>();
    String after = null;
    do {
      final var page = bindings.get(access, concept.getId(), MAX_ASSETS, after);
      for (final var binding : page.getAssets()) {
        links.add(new Link(concept, binding.getAsset()));
      }
      after = page.getAfter();
    } while (after != null && links.size() < MAX_ASSETS);
    final Links capped = capped(links);
    return new Links(capped.links(), capped.truncated() || after != null);
  }

  private static Links capped(final List<Link> links) {
    final boolean truncated = links.size() > MAX_ASSETS;
    return new Links(truncated ? List.copyOf(links.subList(0, MAX_ASSETS)) : links, truncated);
  }

  static String withLinks(
      final String graphJson,
      final String baseUri,
      final Links links,
      final Set<String> entityTypes) {
    if (links.links().isEmpty() && !links.truncated()) {
      return graphJson;
    }
    final var graph = (ObjectNode) JsonUtils.readTree(graphJson);
    final var nodes = (ArrayNode) graph.get("nodes");
    final var edges = (ArrayNode) graph.get("edges");
    final Set<String> nodeIds = new HashSet<>();
    nodes.forEach(node -> nodeIds.add(node.path("id").asText()));
    final Set<String> edgeKeys = new HashSet<>();
    edges.forEach(edge -> edgeKeys.add(edgeKey(edge)));
    for (final var link : links.links()) {
      final String from = iri(baseUri, link.concept());
      final String to = iri(baseUri, link.asset());
      if (addable(nodeIds, from, link.concept(), entityTypes)
          && addable(nodeIds, to, link.asset(), entityTypes)) {
        addNode(nodes, nodeIds, from, link.concept());
        addNode(nodes, nodeIds, to, link.asset());
        addEdge(edges, edgeKeys, from, to);
      }
    }
    graph.put("totalNodes", nodes.size());
    graph.put("totalEdges", edges.size());
    if (links.truncated()) {
      graph.put("truncated", true);
    }
    return JsonUtils.pojoToJson(graph);
  }

  private static boolean wanted(final Set<String> relationshipTypes) {
    return relationshipTypes.isEmpty()
        || relationshipTypes.stream().anyMatch(BOUND_ASSET::equalsIgnoreCase);
  }

  private static boolean bindable(final String entityType) {
    return Arrays.stream(OntologyBindingAssetType.values())
        .anyMatch(type -> type.value().equals(entityType));
  }

  private static boolean addable(
      final Set<String> nodeIds,
      final String id,
      final EntityReference entity,
      final Set<String> entityTypes) {
    return nodeIds.contains(id)
        || entityTypes.isEmpty()
        || entityTypes.stream().anyMatch(entity.getType()::equalsIgnoreCase);
  }

  private static String iri(final String baseUri, final EntityReference entity) {
    final String base = baseUri.endsWith("/") ? baseUri : baseUri + "/";
    return base + "entity/" + entity.getType() + "/" + entity.getId();
  }

  private static String edgeKey(final JsonNode edge) {
    return edge.path("from").asText()
        + "|"
        + edge.path("relationType").asText()
        + "|"
        + edge.path("to").asText();
  }

  private static void addNode(
      final ArrayNode nodes,
      final Set<String> nodeIds,
      final String id,
      final EntityReference entity) {
    if (!nodeIds.add(id)) {
      return;
    }
    final ObjectNode node = nodes.addObject();
    node.put("id", id);
    node.put("entityId", entity.getId().toString());
    node.put("type", entity.getType());
    node.put("group", entity.getType().toLowerCase(Locale.ROOT));
    node.put(
        "label",
        entity.getDisplayName() != null && !entity.getDisplayName().isBlank()
            ? entity.getDisplayName()
            : entity.getName());
    node.put("name", entity.getName());
    node.put("fullyQualifiedName", entity.getFullyQualifiedName());
    if (entity.getDescription() != null && !entity.getDescription().isBlank()) {
      node.put("description", entity.getDescription());
    }
  }

  private static void addEdge(
      final ArrayNode edges, final Set<String> edgeKeys, final String from, final String to) {
    if (!edgeKeys.add(from + "|" + BOUND_ASSET + "|" + to)) {
      return;
    }
    final ObjectNode edge = edges.addObject();
    edge.put("from", from);
    edge.put("to", to);
    edge.put("label", "Bound asset");
    edge.put("relationType", BOUND_ASSET);
    edge.put("arrows", "to");
  }
}
