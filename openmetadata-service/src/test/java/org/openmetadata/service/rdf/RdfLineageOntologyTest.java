package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.reasoner.Reasoner;
import org.apache.jena.reasoner.ReasonerRegistry;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.update.UpdateAction;
import org.apache.jena.vocabulary.OWL;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.type.EntityRelationship;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

class RdfLineageOntologyTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String OM = BASE + "ontology/";
  private static final String PROV = "http://www.w3.org/ns/prov#";
  private static final String GRAPH = BASE + "graph/knowledge";
  private final Dataset dataset = DatasetFactory.create();
  private final UUID sourceId = UUID.randomUUID();
  private final UUID targetId = UUID.randomUUID();
  private final Model graph = dataset.getNamedModel(GRAPH);
  private final Resource source = graph.createResource(BASE + "entity/table/" + sourceId);
  private final Resource target = graph.createResource(BASE + "entity/table/" + targetId);
  private final RdfRepository repository = repository();

  @AfterEach
  void close() {
    dataset.close();
  }

  @Test
  void reindexWritesBothDeclaredDirectionsWithoutInference() {
    graph.add(repository.buildLineageModel("table", sourceId, "table", targetId, null));
    assertCanonicalLineage();
    assertFalse(graph.contains(null, graph.createProperty(OM + "UPSTREAM")));
  }

  @Test
  void liveWritesUseTheSameDirectionAsReindexAndDeleteEveryAlias() {
    repository.addRelationship(relationship());
    assertCanonicalLineage();
    repository.removeRelationship(relationship());
    assertTrue(graph.isEmpty());
  }

  @Test
  void deletingLineageAlsoRemovesLegacyEdges() {
    graph.add(source, graph.createProperty(OM + "UPSTREAM"), target);
    graph.add(target, graph.createProperty(PROV + "wasDerivedFrom"), source);
    repository.removeRelationship(relationship());
    assertTrue(graph.isEmpty());
  }

  @Test
  void liveUpdatesRepairOldDirectionWithoutDeletingAnExistingReciprocalEdge() {
    graph.add(source, graph.createProperty(PROV + "wasDerivedFrom"), target);
    graph.add(source, graph.createProperty(OM + "UPSTREAM"), target);
    repository.addRelationship(relationship());
    assertCanonicalLineage();
    final EntityRelationship reverse =
        new EntityRelationship()
            .withFromEntity("table")
            .withFromId(targetId)
            .withToEntity("table")
            .withToId(sourceId)
            .withRelationshipType(Relationship.UPSTREAM);
    repository.addRelationship(reverse);
    repository.removeRelationship(relationship());
    assertEquals(3, graph.size());
    assertTrue(graph.contains(source, graph.createProperty(PROV + "wasDerivedFrom"), target));
    assertTrue(graph.contains(source, graph.createProperty(OM + "upstream"), target));
    assertTrue(graph.contains(target, graph.createProperty(OM + "downstream"), source));
  }

  @Test
  void bulkRelationshipsWithoutDetailsUseCanonicalLineageAndDeleteLegacyDirection() {
    graph.add(source, graph.createProperty(PROV + "wasDerivedFrom"), target);
    repository.bulkAddRelationships(List.of(relationship()));
    assertCanonicalLineage();
  }

  @ParameterizedTest
  @ValueSource(strings = {"upstream", "downstream", "UPSTREAM"})
  void traversalsReadCanonicalAndLegacyEdgesUsingProjectedLabels(final String predicate) {
    if (predicate.equals("upstream"))
      graph.add(target, graph.createProperty(OM + predicate), source);
    else graph.add(source, graph.createProperty(OM + predicate), target);
    graph
        .add(source, RDF.type, graph.createResource(OM + "Table"))
        .add(source, RDFS.label, "source");
    graph
        .add(target, RDF.type, graph.createResource(OM + "Table"))
        .add(target, RDFS.label, "target");
    assertTraversal(targetId, RdfGraphService.LineageDirection.UPSTREAM, source);
    assertTraversal(sourceId, RdfGraphService.LineageDirection.DOWNSTREAM, target);
  }

  private void assertTraversal(
      final UUID id, final RdfGraphService.LineageDirection direction, final Resource expected) {
    final String query = RdfGraphService.buildLineageQuery(id, "table", direction, BASE);
    try (QueryExecution execution = QueryExecution.create(query, graph)) {
      final var results = execution.execSelect();
      assertTrue(results.hasNext());
      assertEquals(expected, results.next().getResource("entity"));
      assertFalse(results.hasNext());
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"rdfs", "owl"})
  void ontologyInfersProvenanceFromCanonicalUpstreamWithoutReifyingTheSource(final String level) {
    final Model ontology = RDFDataMgr.loadModel("rdf/ontology/openmetadata.ttl");
    final Resource upstream = ontology.createResource(OM + "upstream");
    assertTrue(
        ontology.contains(
            upstream, RDFS.subPropertyOf, ontology.createResource(PROV + "wasDerivedFrom")));
    assertFalse(
        ontology.contains(
            upstream,
            OWL.equivalentProperty,
            ontology.createResource("http://www.w3.org/ns/dcat#qualifiedRelation")));
    graph.add(target, graph.createProperty(OM + "upstream"), source);
    ontology.add(
        ontology.createResource("http://www.w3.org/ns/dcat#qualifiedRelation"),
        RDFS.range,
        ontology.createResource("http://www.w3.org/ns/dcat#Relationship"));
    final Reasoner reasoner =
        level.equals("rdfs")
            ? ReasonerRegistry.getRDFSReasoner()
            : ReasonerRegistry.getOWLMicroReasoner();
    final Model inferred = ModelFactory.createInfModel(reasoner.bindSchema(ontology), graph);
    assertTrue(inferred.contains(target, inferred.createProperty(PROV + "wasDerivedFrom"), source));
    assertFalse(
        inferred.contains(
            source, RDF.type, inferred.createResource("http://www.w3.org/ns/dcat#Relationship")));
    inferred.close();
    ontology.close();
  }

  private void assertCanonicalLineage() {
    assertTrue(graph.contains(target, graph.createProperty(OM + "upstream"), source));
    assertTrue(graph.contains(source, graph.createProperty(OM + "downstream"), target));
    assertTrue(graph.contains(target, graph.createProperty(PROV + "wasDerivedFrom"), source));
    assertFalse(graph.contains(source, graph.createProperty(PROV + "wasDerivedFrom"), target));
    assertEquals(3, graph.size());
  }

  private EntityRelationship relationship() {
    return new EntityRelationship()
        .withFromId(sourceId)
        .withFromEntity("table")
        .withToId(targetId)
        .withToEntity("table")
        .withRelationshipType(Relationship.UPSTREAM);
  }

  private RdfRepository repository() {
    final RdfStorageInterface storage = mock(RdfStorageInterface.class);
    doAnswer(
            invocation -> {
              UpdateAction.parseExecute(invocation.getArgument(0, String.class), dataset);
              return null;
            })
        .when(storage)
        .executeSparqlUpdate(anyString());
    return new RdfRepository(
        new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE)), storage, null);
  }
}
