package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyConceptDeleteImpactIT extends BaseOntologyApprovalIT {
  @Test
  void impactNamesChildrenRelationshipsAndRulesAndDeletionSucceedsOnceTheyAreRemoved(
      TestNamespace ns) {
    Ontology ontology = createOntology(ns);
    var animal = declareClass(ontology, "Animal", URI.create("urn:example:Animal"));
    var dog = declareClass(ontology, "Dog", URI.create("urn:example:Dog"));
    var plant = declareClass(ontology, "Plant", URI.create("urn:example:Plant"));
    OntologyAxiom dogIsAnimal =
        axiom(
            ontology, "DogIsAnimal", OntologyAxiomType.SUBCLASS_OF, dog.getIri(), animal.getIri());
    OntologyAxiom plantVsAnimal =
        axiom(
            ontology,
            "PlantVsAnimal",
            OntologyAxiomType.DISJOINT_WITH,
            plant.getIri(),
            animal.getIri());

    JsonNode impact = impact(animal.getId());
    assertEquals(List.of("Dog"), names(impact.path("children")));
    assertEquals(List.of("DogIsAnimal"), names(impact.path("relationships")));
    assertEquals(List.of("PlantVsAnimal"), names(impact.path("rules")));
    assertEquals(0, impact.path("blockers").size());

    OpenMetadataException blocked =
        assertThrows(
            OpenMetadataException.class,
            () -> SdkClients.adminClient().ontologyConcepts().delete(animal.getId()));
    assertEquals(400, blocked.getStatusCode());

    SdkClients.adminClient().ontologyAxioms().delete(dogIsAnimal.getId());
    SdkClients.adminClient().ontologyAxioms().delete(plantVsAnimal.getId());
    SdkClients.adminClient().ontologyConcepts().delete(animal.getId());

    assertNotEquals(
        Boolean.TRUE, SdkClients.adminClient().ontologyConcepts().get(dog.getId()).getDeleted());
  }

  @Test
  void impactIsEmptyForAnUnreferencedConcept(TestNamespace ns) {
    Ontology ontology = createOntology(ns);
    var lonely = declareClass(ontology, "Lonely", URI.create("urn:example:Lonely"));

    JsonNode impact = impact(lonely.getId());

    assertEquals(0, impact.path("children").size());
    assertEquals(0, impact.path("relationships").size());
    assertEquals(0, impact.path("rules").size());
    assertEquals(0, impact.path("blockers").size());
    assertEquals(lonely.getId().toString(), impact.path("concept").path("id").asText());
  }

  private static OntologyAxiom axiom(
      Ontology ontology, String name, OntologyAxiomType type, URI subject, URI parent) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/ontologyAxioms",
            new CreateOntologyAxiom()
                .withName(name)
                .withDisplayName(name)
                .withDescription("Delete impact test")
                .withOntology(ontology.getFullyQualifiedName())
                .withAxiomType(type)
                .withProvenance(RelationProvenance.MANUAL)
                .withSubjectIri(subject)
                .withExpressions(
                    List.of(
                        new OntologyExpression()
                            .withKind(OntologyExpressionKind.NAMED_CLASS)
                            .withClassIri(parent))),
            OntologyAxiom.class);
  }

  private static JsonNode impact(UUID conceptId) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/ontologyConcepts/" + conceptId + "/deleteImpact",
            null,
            JsonNode.class);
  }

  private static List<String> names(JsonNode references) {
    List<String> names = new ArrayList<>();
    references.forEach(reference -> names.add(reference.path("name").asText()));
    return names;
  }
}
