package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.RDFList;
import org.apache.jena.riot.RDFParser;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.rdf.RdfSerializationFormat;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyReleaseExportIT extends BaseOntologyApprovalIT {
  private static final URI CUSTOMER = URI.create("https://example.org/model/Customer");
  private static final URI PARTY = URI.create("https://example.org/model/Party");
  private static final URI KNOWS = URI.create("https://example.org/model/knows");

  @Test
  void structuralGateProtectsDeclarationsAndReportsTheFrozenModelAfterDeletion(TestNamespace ns) {
    var client = SdkClients.adminClient();
    Ontology ontology = createOntology(ns, "structure");
    declareClass(ontology, "Customer", CUSTOMER);
    declareClass(ontology, "Party", PARTY);
    var declaration = client.ontologyProperties().create(property(ontology));
    var assertion =
        client
            .ontologyAxioms()
            .create(
                new CreateOntologyAxiom()
                    .withName("customer-knows-party")
                    .withDisplayName("Customer knows party")
                    .withDescription("A captured object-property assertion")
                    .withProvenance(RelationProvenance.MANUAL)
                    .withOntology(ontology.getFullyQualifiedName())
                    .withSubjectIri(CUSTOMER)
                    .withAxiomType(OntologyAxiomType.OBJECT_PROPERTY_ASSERTION)
                    .withPropertyIri(KNOWS)
                    .withTargetIri(PARTY));
    OntologyRelease valid = capture(ontology);
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () ->
                    client
                        .ontologyProperties()
                        .patch(
                            declaration.getId(),
                            JsonUtils.readTree(
                                """
                                [{"op":"replace","path":"/kind","value":"DATA"},
                                 {"op":"replace","path":"/range","value":[]}]
                                """)))
            .getStatusCode());
    client.ontologyAxioms().delete(assertion.getId().toString(), Map.of("hardDelete", "true"));
    client
        .ontologyProperties()
        .delete(declaration.getId().toString(), Map.of("hardDelete", "true"));

    var validReport = client.ontologyReleases().structure(valid.getId());
    assertTrue(validReport.getValid());
    assertEquals(valid.getContentDigest(), validReport.getContentDigest());
    assertEquals(0, validReport.getViolationCount());
    assertEquals(
        valid.getEntityStatus(), client.ontologyReleases().get(valid.getId()).getEntityStatus());
  }

  @ParameterizedTest
  @EnumSource(RdfSerializationFormat.class)
  void exportsFrozenDefinitionsWithoutAnRdfServer(RdfSerializationFormat format, TestNamespace ns) {
    var client = SdkClients.adminClient();
    Ontology ontology = createOntology(ns, "export" + format.name());
    var concept =
        client
            .ontologyConcepts()
            .create(
                new CreateOntologyConcept()
                    .withName("Customer")
                    .withDisplayName("Captured label")
                    .withIri(CUSTOMER)
                    .withConceptType(OntologyConceptType.OWL_CLASS)
                    .withOntology(ontology.getFullyQualifiedName()));
    declareClass(ontology, "Party", PARTY);
    var objectProperty = client.ontologyProperties().create(property(ontology));
    var dataProperty =
        client
            .ontologyProperties()
            .create(
                new CreateOntologyProperty()
                    .withName("customerCode")
                    .withOntology(ontology.getFullyQualifiedName())
                    .withKind(OntologyPropertyKind.DATA)
                    .withIri(URI.create("urn:example:customerCode"))
                    .withEnumValues(
                        List.of(
                            new OntologyLiteral().withValue("Gold"),
                            new OntologyLiteral().withValue("Silver")))
                    .withUnit("kg")
                    .withIsIdentifier(true));
    var subclass = client.ontologyAxioms().create(axiom(ontology));
    OntologyRelease release = capture(ontology);
    client.ontologyConcepts().update(concept.getId(), concept.withDisplayName("Later label"));
    client.ontologyAxioms().delete(subclass.getId().toString(), Map.of("hardDelete", "true"));
    client
        .ontologyProperties()
        .delete(objectProperty.getId().toString(), Map.of("hardDelete", "true"));
    client.ontologyConcepts().delete(concept.getId().toString(), Map.of("hardDelete", "true"));
    client
        .ontologyProperties()
        .update(
            dataProperty.getId(),
            dataProperty
                .withEnumValues(
                    List.of(
                        new OntologyLiteral().withValue("Later value"),
                        new OntologyLiteral().withValue("Other later value")))
                .withUnit("g"));
    client
        .ontologyProperties()
        .delete(dataProperty.getId().toString(), Map.of("hardDelete", "true"));

    String exported = export(client, release.getId(), format.externalName());
    Model model = ModelFactory.createDefaultModel();
    try {
      RDFParser.fromString(exported, format.rdfFormat().getLang()).parse(model);
      assertTrue(
          model.contains(model.createResource(CUSTOMER.toString()), RDFS.label, "Captured label"));
      assertFalse(model.contains(null, RDFS.label, "Later label"));
      assertTrue(
          model.contains(
              model.createResource(CUSTOMER.toString()),
              RDFS.subClassOf,
              model.createResource(PARTY.toString())));
      assertTrue(
          model.contains(model.createResource(KNOWS.toString()), RDF.type, OWL2.ObjectProperty));
      final var values =
          model
              .getResource("urn:example:customerCode")
              .getProperty(RDFS.range)
              .getResource()
              .getProperty(OWL2.equivalentClass)
              .getResource()
              .getProperty(OWL2.oneOf)
              .getResource()
              .as(RDFList.class)
              .asJavaList();
      assertEquals(
          List.of("Gold", "Silver"),
          values.stream().map(value -> value.asLiteral().getString()).toList());
      assertTrue(
          model.contains(
              model.getResource("urn:example:customerCode"),
              model.createProperty("https://open-metadata.org/ontology/unitAnnotation"),
              "kg"));
      assertFalse(
          model.contains(
              model.getResource("urn:example:customerCode"), RDF.type, OWL2.FunctionalProperty));
      assertTrue(
          model.contains(
              model.createResource(ontology.getIri().toString()),
              OWL2.versionIRI,
              model.createResource(release.getVersionIri().toString())));
    } finally {
      model.close();
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"ontologyConcept", "ontologyProperty", "ontologyAxiom"})
  void exportRequiresPermissionForEveryFrozenMember(String deniedType, TestNamespace ns) {
    var client = SdkClients.adminClient();
    Ontology ontology = createOntology(ns, "denied" + deniedType);
    var concept =
        client
            .ontologyConcepts()
            .create(
                new CreateOntologyConcept()
                    .withName("Customer")
                    .withIri(CUSTOMER)
                    .withConceptType(OntologyConceptType.OWL_CLASS)
                    .withOntology(ontology.getFullyQualifiedName()));
    declareClass(ontology, "Party", PARTY);
    var property = client.ontologyProperties().create(property(ontology));
    var axiom = client.ontologyAxioms().create(axiom(ontology));
    OntologyRelease release = capture(ontology);
    try (RdfAccessFixtures fixtures =
        new RdfAccessFixtures("export" + deniedType + ns.shortPrefix())) {
      var role = fixtures.denyRole(MetadataOperation.VIEW_ALL, deniedType);
      String token = fixtures.userToken("reader", List.of(role.getId()));
      var denied =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(token)
                  .build());
      assertNotNull(
          denied
              .getHttpClient()
              .execute(
                  HttpMethod.GET,
                  "/v1/ontologyReleases/" + release.getId(),
                  null,
                  OntologyRelease.class));
      assertEquals(
          403,
          assertThrows(OpenMetadataException.class, () -> export(denied, release.getId(), "turtle"))
              .getStatusCode());
      assertEquals(
          403,
          assertThrows(
                  OpenMetadataException.class,
                  () -> denied.ontologyReleases().structure(release.getId()))
              .getStatusCode());
      client.ontologyAxioms().delete(axiom.getId().toString(), Map.of("hardDelete", "true"));
      client.ontologyProperties().delete(property.getId().toString(), Map.of("hardDelete", "true"));
      client.ontologyConcepts().delete(concept.getId().toString(), Map.of("hardDelete", "true"));
      assertEquals(
          403,
          assertThrows(OpenMetadataException.class, () -> export(denied, release.getId(), "turtle"))
              .getStatusCode());
      assertEquals(
          403,
          assertThrows(
                  OpenMetadataException.class,
                  () -> denied.ontologyReleases().structure(release.getId()))
              .getStatusCode());
    }
  }

  @Test
  void rejectsUnknownFormatsAndMissingReleases(TestNamespace ns) {
    OntologyRelease release = capture(createOntology(ns));
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> export(SdkClients.adminClient(), release.getId(), "unknown"))
            .getStatusCode());
    assertEquals(
        404,
        assertThrows(
                OpenMetadataException.class,
                () -> export(SdkClients.adminClient(), UUID.randomUUID(), "turtle"))
            .getStatusCode());
  }

  private static CreateOntologyProperty property(Ontology ontology) {
    return new CreateOntologyProperty()
        .withName("knows")
        .withIri(KNOWS)
        .withKind(OntologyPropertyKind.OBJECT)
        .withDomain(List.of(CUSTOMER))
        .withRange(List.of(PARTY))
        .withOntology(ontology.getFullyQualifiedName());
  }

  private static CreateOntologyAxiom axiom(Ontology ontology) {
    return new CreateOntologyAxiom()
        .withName("customer-is-party")
        .withDisplayName("Customer is a party")
        .withDescription("Every customer is a party")
        .withOntology(ontology.getFullyQualifiedName())
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withSubjectIri(CUSTOMER)
        .withProvenance(RelationProvenance.MANUAL)
        .withExpressions(
            List.of(
                new OntologyExpression()
                    .withKind(OntologyExpressionKind.NAMED_CLASS)
                    .withClassIri(PARTY)));
  }

  private static String export(OpenMetadataClient client, UUID releaseId, String format) {
    return client
        .getHttpClient()
        .executeForString(
            HttpMethod.GET,
            "/v1/ontologyReleases/" + releaseId + "/export?format=" + format,
            null,
            RequestOptions.builder().header("Accept", "*/*").build());
  }
}
