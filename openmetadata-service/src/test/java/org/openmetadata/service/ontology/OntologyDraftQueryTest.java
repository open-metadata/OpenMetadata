package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot.Entry;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot.Snapshot;

class OntologyDraftQueryTest {
  private static final String EX = "https://example.org/clinical/";
  private static final Ontology ROOT =
      new Ontology()
          .withId(UUID.randomUUID())
          .withName("clinical")
          .withFullyQualifiedName("clinical")
          .withIri(URI.create(EX))
          .withNamespace(URI.create(EX));

  private static final String CLASSES =
      "SELECT ?c WHERE { ?c a <http://www.w3.org/2002/07/owl#Class> } ORDER BY ?c";

  @Test
  void answersFromTheWorkingDefinitionsNotOnlyTheSealedOnes() {
    final var query =
        new OntologyDraftQuery(source(root(), concept("Patient"), concept("Allergy")));

    final var result =
        query.query(ROOT.getId(), new SparqlQuery().withQuery(CLASSES), ignored -> {});

    assertEquals(List.of(EX + "Allergy", EX + "Patient"), classIris(result.body()));
  }

  @Test
  void passesEveryWorkingDefinitionToTheAccessCheck() {
    final List<String> checked = new ArrayList<>();
    final var query = new OntologyDraftQuery(source(root(), concept("Patient")));

    query.query(
        ROOT.getId(),
        new SparqlQuery().withQuery(CLASSES),
        definitions -> definitions.forEach(definition -> checked.add(definition.getName())));

    assertEquals(List.of("clinical", "Patient"), checked);
  }

  @Test
  void anAccessRefusalStopsTheQueryBeforeAnyResult() {
    final var query = new OntologyDraftQuery(source(root(), concept("Patient")));

    final var refused =
        assertThrows(
            IllegalStateException.class,
            () ->
                query.query(
                    ROOT.getId(),
                    new SparqlQuery().withQuery(CLASSES),
                    definitions -> {
                      throw new IllegalStateException("no access");
                    }));

    assertEquals("no access", refused.getMessage());
  }

  @Test
  void aServiceClauseIsRefusedLikeOnThePublishedScope() {
    final var query = new OntologyDraftQuery(source(root(), concept("Patient")));

    final var refused =
        assertThrows(
            RuntimeException.class,
            () ->
                query.query(
                    ROOT.getId(),
                    new SparqlQuery()
                        .withQuery(
                            "SELECT * WHERE { SERVICE <http://localhost:9999/> { ?s ?p ?o } }"),
                    ignored -> {}));

    assertTrue(refused.getMessage().toLowerCase().contains("federation"));
  }

  private static List<String> classIris(final String body) {
    final JsonNode json = JsonUtils.readTree(body);
    final List<String> iris = new ArrayList<>();
    json.path("results")
        .path("bindings")
        .forEach(binding -> iris.add(binding.path("c").path("value").asText()));
    return iris;
  }

  private static Entry root() {
    return new Entry(MemberKind.ONTOLOGY, ROOT);
  }

  private static Entry concept(final String name) {
    return new Entry(
        MemberKind.CONCEPT,
        new OntologyConcept()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName("clinical." + name)
            .withIri(URI.create(EX + name))
            .withOntology(ROOT.getEntityReference())
            .withConceptType(OntologyConceptType.OWL_CLASS));
  }

  private static OntologyDraftQuery.Source source(final Entry... entries) {
    return new OntologyDraftQuery.Source() {
      @Override
      public <T> T read(
          final UUID ontologyId,
          final Consumer<List<? extends OntologyDefinition>> authorize,
          final Function<Snapshot, T> callback) {
        authorize.accept(List.of(entries).stream().map(Entry::definition).toList());
        return callback.apply(
            new Snapshot(
                new OntologyState()
                    .withOntologyId(ontologyId)
                    .withWorkingRevision(3L)
                    .withActivationRevision(1L)
                    .withLastReleaseRevision(1L),
                List.of(entries)));
      }
    };
  }
}
