package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.OntologyActiveGraph;
import org.openmetadata.service.rdf.RdfRepository;

/** An activated release serves its property hierarchy as {@code rdfs:subPropertyOf} over SPARQL. */
@Tag("rdf")
@EnabledIfSystemProperty(named = "enableRdf", matches = "true")
@ExtendWith(TestNamespaceExtension.class)
public class RdfOntologyPropertyHierarchyIT extends BaseOntologyApprovalIT {
  private static final URI HAS_RELATIVE = URI.create("https://example.org/model/hasRelative");
  private static final URI HAS_CHILD = URI.create("https://example.org/model/hasChild");
  private static final String SUB_PROPERTY_OF =
      "<http://www.w3.org/2000/01/rdf-schema#subPropertyOf>";

  @Test
  void anActivatedReleaseServesSubPropertyOfTriples(TestNamespace ns) {
    final Ontology ontology = createOntology(ns, "servedHierarchy");
    final var service = SdkClients.adminClient().ontologyProperties();
    service.create(property(ontology, "hasRelative", HAS_RELATIVE));
    service.create(
        property(ontology, "hasChild", HAS_CHILD).withSuperProperties(List.of(HAS_RELATIVE)));

    activate(ns, ontology);

    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .until(
            () ->
                ask(
                    ontology,
                    "<" + HAS_CHILD + "> " + SUB_PROPERTY_OF + " <" + HAS_RELATIVE + ">"));
    assertTrue(
        ask(
            ontology,
            "<"
                + HAS_CHILD
                + "> a <http://www.w3.org/2002/07/owl#ObjectProperty> . <"
                + HAS_RELATIVE
                + "> a <http://www.w3.org/2002/07/owl#ObjectProperty>"));
  }

  private static CreateOntologyProperty property(Ontology ontology, String name, URI iri) {
    return new CreateOntologyProperty()
        .withName(name)
        .withOntology(ontology.getFullyQualifiedName())
        .withKind(OntologyPropertyKind.OBJECT)
        .withIri(iri);
  }

  private static boolean ask(Ontology ontology, String pattern) {
    return JsonUtils.readTree(
            RdfRepository.getInstance()
                .executeSparqlQuery(
                    "ASK { GRAPH <"
                        + OntologyActiveGraph.graph(ontology.getId())
                        + "> { "
                        + pattern
                        + " } }",
                    "json"))
        .path("boolean")
        .asBoolean();
  }
}
