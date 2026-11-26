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
import java.util.regex.Pattern;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.rdf.RdfGraphService.GraphRequest;
import org.openmetadata.service.security.AuthorizationException;

/**
 * Adds a root entity's concept bindings to its explore graph. The knowledge graph states every
 * binding to anyone who may query it, so each request reads them from SQL with the caller's
 * permissions instead, after the graph cache, and they are never stale
 * (ADR:2026-10-19-native-concept-bindings-remain-operational-metadata). The edge runs concept to
 * asset under the predicate the release export and the knowledge graph write, {@code
 * om:boundAsset}.
 */
public final class OntologyBindingGraphLinks {
  public static final String BOUND_ASSET = "boundAsset";
  static final int MAX_ASSETS = OntologyConceptBindingService.MAX_PAGE_SIZE;
  private static final String FILTER_OPTIONS = "filterOptions";
  private static final String ENTITY_TYPE_OPTIONS = "entityTypes";
  private static final String RELATIONSHIP_TYPE_OPTIONS = "relationshipTypes";
  private static final Pattern CAMEL_CASE_BOUNDARY = Pattern.compile("([a-z])([A-Z])");

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
    final MergedGraph graph = new MergedGraph(graphJson);
    links.links().forEach(link -> graph.add(link, baseUri, entityTypes));
    return graph.toJson(links.truncated());
  }

  private static boolean wanted(final Set<String> relationshipTypes) {
    return relationshipTypes.isEmpty()
        || relationshipTypes.stream().anyMatch(BOUND_ASSET::equalsIgnoreCase);
  }

  private static boolean bindable(final String entityType) {
    return Arrays.stream(OntologyBindingAssetType.values())
        .anyMatch(type -> type.value().equals(entityType));
  }

  private static String iri(final String baseUri, final EntityReference entity) {
    final String base = baseUri.endsWith("/") ? baseUri : baseUri + "/";
    return base + "entity/" + entity.getType() + "/" + entity.getId();
  }

  private static String edgeKey(final JsonNode edge) {
    return edgeKey(
        edge.path("from").asText(), edge.path("relationType").asText(), edge.path("to").asText());
  }

  private static String edgeKey(final String from, final String relationType, final String to) {
    return from + "|" + relationType + "|" + to;
  }

  /** Same wording the RDF graph gives a filter option it has no fixed label for. */
  private static String label(final String id) {
    final String spaced = CAMEL_CASE_BOUNDARY.matcher(id).replaceAll("$1 $2");
    return spaced.isEmpty()
        ? spaced
        : Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
  }

  private static void describeNode(
      final ObjectNode node, final String id, final EntityReference entity) {
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

  private static void describeEdge(final ObjectNode edge, final String from, final String to) {
    edge.put("from", from);
    edge.put("to", to);
    edge.put("label", "Bound asset");
    edge.put("relationType", BOUND_ASSET);
    edge.put("arrows", "to");
  }

  /** The explore response being merged, indexed so each added node and edge appears once. */
  private static final class MergedGraph {
    private final ObjectNode graph;
    private final ArrayNode nodes;
    private final ArrayNode edges;
    private final ObjectNode filterOptions;
    private final Set<String> nodeIds = new HashSet<>();
    private final Set<String> edgeKeys = new HashSet<>();

    MergedGraph(final String graphJson) {
      graph = (ObjectNode) JsonUtils.readTree(graphJson);
      nodes = (ArrayNode) graph.get("nodes");
      edges = (ArrayNode) graph.get("edges");
      filterOptions = objectField(graph, FILTER_OPTIONS);
      nodes.forEach(node -> nodeIds.add(node.path("id").asText()));
      edges.forEach(edge -> edgeKeys.add(edgeKey(edge)));
    }

    void add(final Link link, final String baseUri, final Set<String> entityTypes) {
      final String from = iri(baseUri, link.concept());
      final String to = iri(baseUri, link.asset());
      if (addable(from, link.concept(), entityTypes) && addable(to, link.asset(), entityTypes)) {
        addNode(from, link.concept());
        addNode(to, link.asset());
        addEdge(from, to);
      }
    }

    String toJson(final boolean truncated) {
      graph.put("totalNodes", nodes.size());
      graph.put("totalEdges", edges.size());
      if (truncated) {
        graph.put("truncated", true);
      }
      return JsonUtils.pojoToJson(graph);
    }

    private boolean addable(
        final String id, final EntityReference entity, final Set<String> entityTypes) {
      return nodeIds.contains(id)
          || entityTypes.isEmpty()
          || entityTypes.stream().anyMatch(entity.getType()::equalsIgnoreCase);
    }

    private void addNode(final String id, final EntityReference entity) {
      if (nodeIds.add(id)) {
        describeNode(nodes.addObject(), id, entity);
        count(ENTITY_TYPE_OPTIONS, entity.getType());
      }
    }

    private void addEdge(final String from, final String to) {
      if (edgeKeys.add(edgeKey(from, BOUND_ASSET, to))) {
        describeEdge(edges.addObject(), from, to);
        count(RELATIONSHIP_TYPE_OPTIONS, BOUND_ASSET);
      }
    }

    private void count(final String group, final String id) {
      final ObjectNode option = optionFor(arrayField(filterOptions, group), id);
      option.put("count", option.path("count").asInt() + 1);
    }

    private static ObjectNode optionFor(final ArrayNode options, final String id) {
      for (final JsonNode option : options) {
        if (id.equals(option.path("id").asText())) {
          return (ObjectNode) option;
        }
      }
      return options.addObject().put("id", id).put("label", label(id)).put("count", 0);
    }

    private static ObjectNode objectField(final ObjectNode parent, final String name) {
      return parent.get(name) instanceof ObjectNode field ? field : parent.putObject(name);
    }

    private static ArrayNode arrayField(final ObjectNode parent, final String name) {
      return parent.get(name) instanceof ArrayNode field ? field : parent.putArray(name);
    }
  }
}
