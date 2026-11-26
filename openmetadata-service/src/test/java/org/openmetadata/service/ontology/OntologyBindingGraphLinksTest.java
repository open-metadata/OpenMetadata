package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.networknt.schema.SchemaLocation;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.rdf.EntityGraph;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyAssetConceptLink;
import org.openmetadata.schema.type.OntologyAssetConceptLinks;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyConceptBindingsResponse;
import org.openmetadata.schema.type.OntologyHydratedAssetBinding;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.rdf.RdfGraphService.GraphRequest;

class OntologyBindingGraphLinksTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final OntologyConceptBindingService.Access ACCESS =
      new OntologyConceptBindingService.Access(null, null);

  private final OntologyConceptBindingService bindings = mock(OntologyConceptBindingService.class);
  private final OntologyBindingGraphLinks links = new OntologyBindingGraphLinks(bindings);

  @Test
  void aTableGraphGainsEachBoundConceptWithAnEdgeFromTheConcept() throws Exception {
    final UUID table = UUID.randomUUID();
    final EntityReference patient = concept("Patient");
    when(bindings.linksForAsset(ACCESS, "table", table))
        .thenReturn(
            new OntologyAssetConceptLinks()
                .withLinks(List.of(new OntologyAssetConceptLink().withConcept(patient))));

    final JsonNode graph = merge(rootGraph("table", table), request(table, "table", 2, Set.of()));

    final JsonNode node = node(graph, iri("ontologyConcept", patient.getId()));
    assertEquals("ontologyConcept", node.path("type").asText());
    assertEquals("Patient", node.path("label").asText());
    assertEquals("onto.Patient", node.path("fullyQualifiedName").asText());
    final JsonNode edge = graph.path("edges").get(0);
    assertEquals(iri("ontologyConcept", patient.getId()), edge.path("from").asText());
    assertEquals(iri("table", table), edge.path("to").asText());
    assertEquals(OntologyBindingGraphLinks.BOUND_ASSET, edge.path("relationType").asText());
    assertEquals(2, graph.path("totalNodes").asInt());
    assertEquals(1, graph.path("totalEdges").asInt());
    assertConformsToExploreContract(graph);
  }

  @Test
  void aBoundNodeOmitsUnavailableText() throws Exception {
    final UUID table = UUID.randomUUID();
    final EntityReference unnamed =
        new EntityReference().withId(UUID.randomUUID()).withType("ontologyConcept");
    when(bindings.linksForAsset(ACCESS, "table", table))
        .thenReturn(
            new OntologyAssetConceptLinks()
                .withLinks(List.of(new OntologyAssetConceptLink().withConcept(unnamed))));

    final JsonNode graph = merge(rootGraph("table", table), request(table, "table", 2, Set.of()));

    assertEquals(4, node(graph, iri("ontologyConcept", unnamed.getId())).size());
    assertConformsToExploreContract(graph);
  }

  @Test
  void theAddedConceptsAndEdgesAreOfferedAsFilters() {
    final UUID table = UUID.randomUUID();
    when(bindings.linksForAsset(ACCESS, "table", table))
        .thenReturn(
            new OntologyAssetConceptLinks()
                .withLinks(
                    List.of(
                        new OntologyAssetConceptLink().withConcept(concept("Patient")),
                        new OntologyAssetConceptLink().withConcept(concept("Visit")))));
    final String rdfGraph = rootGraph("table", table);

    final JsonNode filters =
        merge(rdfGraph, request(table, "table", 2, Set.of())).path("filterOptions");

    assertEquals(1, option(filters.path("entityTypes"), "table").path("count").asInt());
    final JsonNode concepts = option(filters.path("entityTypes"), "ontologyConcept");
    assertEquals("Ontology Concept", concepts.path("label").asText());
    assertEquals(2, concepts.path("count").asInt());
    final JsonNode bound =
        option(filters.path("relationshipTypes"), OntologyBindingGraphLinks.BOUND_ASSET);
    assertEquals("Bound Asset", bound.path("label").asText());
    assertEquals(2, bound.path("count").asInt());
  }

  @Test
  void aConceptGraphGainsEveryBoundAssetAcrossPages() {
    final EntityReference patient = concept("Patient");
    final EntityReference first = asset("table", "patients");
    final EntityReference second = asset("topic", "admissions");
    when(bindings.get(eq(ACCESS), eq(patient.getId()), eq(100), isNull()))
        .thenReturn(page(List.of(first), "cursor"));
    when(bindings.get(ACCESS, patient.getId(), 100, "cursor"))
        .thenReturn(page(List.of(second), null));

    final JsonNode graph =
        merge(
            rootGraph("ontologyConcept", patient.getId()),
            request(patient.getId(), "ontologyConcept", 2, Set.of()));

    assertEquals(3, graph.path("nodes").size());
    assertEquals("patients", node(graph, iri("table", first.getId())).path("label").asText());
    assertEquals(2, graph.path("edges").size());
    graph
        .path("edges")
        .forEach(
            edge ->
                assertEquals(iri("ontologyConcept", patient.getId()), edge.path("from").asText()));
    assertFalse(graph.path("truncated").asBoolean());
  }

  @Test
  void aConceptWithMoreAssetsThanTheCapIsMarkedTruncated() {
    final EntityReference patient = concept("Patient");
    final List<EntityReference> assets =
        IntStream.range(0, OntologyBindingGraphLinks.MAX_ASSETS)
            .mapToObj(index -> asset("table", "t" + index))
            .toList();
    when(bindings.get(eq(ACCESS), eq(patient.getId()), eq(100), isNull()))
        .thenReturn(page(assets, "more"));

    final JsonNode graph =
        merge(
            rootGraph("ontologyConcept", patient.getId()),
            request(patient.getId(), "ontologyConcept", 2, Set.of()));

    assertEquals(OntologyBindingGraphLinks.MAX_ASSETS + 1, graph.path("nodes").size());
    assertTrue(graph.path("truncated").asBoolean());
  }

  @Test
  void aTableBoundToMoreConceptsThanTheCapIsMarkedTruncated() {
    final UUID table = UUID.randomUUID();
    final List<OntologyAssetConceptLink> bound =
        IntStream.rangeClosed(0, OntologyBindingGraphLinks.MAX_ASSETS)
            .mapToObj(index -> new OntologyAssetConceptLink().withConcept(concept("C" + index)))
            .toList();
    when(bindings.linksForAsset(ACCESS, "table", table))
        .thenReturn(new OntologyAssetConceptLinks().withLinks(bound));

    final JsonNode graph = merge(rootGraph("table", table), request(table, "table", 2, Set.of()));

    assertEquals(OntologyBindingGraphLinks.MAX_ASSETS + 1, graph.path("nodes").size());
    assertTrue(graph.path("truncated").asBoolean());
  }

  @Test
  void aRootOnlyRequestOrAnotherRelationshipFilterLeavesTheGraphAlone() {
    final UUID table = UUID.randomUUID();
    final String graph = rootGraph("table", table);

    assertEquals(graph, links.merge(graph, BASE, request(table, "table", 0, Set.of()), ACCESS));
    assertEquals(
        graph,
        links.merge(
            graph,
            BASE,
            new GraphRequest(table, "table", 2, Set.of(), Set.of("contains")),
            ACCESS));
  }

  @Test
  void anEntityTypeFilterWithoutConceptsAddsNoConcept() {
    final UUID table = UUID.randomUUID();
    when(bindings.linksForAsset(ACCESS, "table", table))
        .thenReturn(
            new OntologyAssetConceptLinks()
                .withLinks(List.of(new OntologyAssetConceptLink().withConcept(concept("P")))));

    final JsonNode graph =
        merge(rootGraph("table", table), request(table, "table", 2, Set.of("table")));

    assertEquals(1, graph.path("nodes").size());
    assertEquals(0, graph.path("edges").size());
  }

  @Test
  void anUnbindableOrMissingRootHasNoLinks() {
    final UUID user = UUID.randomUUID();
    final UUID table = UUID.randomUUID();
    when(bindings.linksForAsset(any(), eq("table"), eq(table)))
        .thenThrow(EntityNotFoundException.byId(table.toString()));

    assertEquals(
        1, merge(rootGraph("user", user), request(user, "user", 2, Set.of())).path("nodes").size());
    assertEquals(
        1,
        merge(rootGraph("table", table), request(table, "table", 2, Set.of()))
            .path("nodes")
            .size());
  }

  private JsonNode merge(final String graph, final GraphRequest request) {
    return JsonUtils.readTree(links.merge(graph, BASE, request, ACCESS));
  }

  private static GraphRequest request(
      final UUID id, final String type, final int depth, final Set<String> entityTypes) {
    return new GraphRequest(id, type, depth, entityTypes, Set.of());
  }

  private static String rootGraph(final String type, final UUID id) {
    return """
        {
          "nodes":[{"id":"%s","entityId":"%s","type":"%s","group":"%s","label":"Root"}],
          "edges":[],"totalNodes":1,"totalEdges":0,"truncated":false,"source":"rdf",
          "filterOptions":{"entityTypes":[{"id":"%s","label":"%s","count":1}],"relationshipTypes":[]}
        }
        """
        .formatted(iri(type, id), id, type, type.toLowerCase(Locale.ROOT), type, type);
  }

  private static void assertConformsToExploreContract(final JsonNode graph) throws Exception {
    final var schema =
        SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12)
            .getSchema(SchemaLocation.of("classpath:json/schema/api/rdf/entityGraph.json"));
    assertEquals(List.of(), schema.validate(graph));
    final EntityGraph response =
        JsonUtils.getObjectMapper()
            .readerFor(EntityGraph.class)
            .with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .readValue(graph.traverse());
    assertEquals(
        OntologyBindingGraphLinks.BOUND_ASSET, response.getEdges().getFirst().getRelationType());
  }

  private static String iri(final String type, final UUID id) {
    return BASE + "entity/" + type + "/" + id;
  }

  private static JsonNode node(final JsonNode graph, final String id) {
    for (final JsonNode node : graph.path("nodes")) {
      if (id.equals(node.path("id").asText())) {
        return node;
      }
    }
    throw new AssertionError("No node " + id + " in " + graph);
  }

  private static JsonNode option(final JsonNode options, final String id) {
    for (final JsonNode option : options) {
      if (id.equals(option.path("id").asText())) {
        return option;
      }
    }
    throw new AssertionError("No filter option " + id + " in " + options);
  }

  private static EntityReference concept(final String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType("ontologyConcept")
        .withName(name)
        .withFullyQualifiedName("onto." + name);
  }

  private static EntityReference asset(final String type, final String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType(type).withName(name);
  }

  private static OntologyConceptBindingsResponse page(
      final List<EntityReference> assets, final String after) {
    return new OntologyConceptBindingsResponse()
        .withRevision(1L)
        .withAfter(after)
        .withAssets(
            assets.stream()
                .map(
                    asset ->
                        new OntologyHydratedAssetBinding()
                            .withAssetType(OntologyBindingAssetType.fromValue(asset.getType()))
                            .withAssetId(asset.getId())
                            .withAsset(asset))
                .toList());
  }
}
