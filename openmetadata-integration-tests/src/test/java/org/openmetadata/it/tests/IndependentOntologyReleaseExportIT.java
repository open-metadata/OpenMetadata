package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.RDFList;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFParser;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.SKOS;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.OntologyReleaseValidation;
import org.openmetadata.schema.api.data.UpdateOntologyConceptBinding;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyAssetBinding;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyConceptBindingsResponse;
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
import org.openmetadata.service.ontology.NativeOntologyCsvCodec;
import org.openmetadata.service.rdf.RdfSerializationFormat;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyReleaseExportIT extends BaseOntologyApprovalIT {
  private static final URI CUSTOMER = URI.create("https://example.org/model/Customer");
  private static final URI PARTY = URI.create("https://example.org/model/Party");
  private static final URI KNOWS = URI.create("https://example.org/model/knows");
  private static final URI KNOWN_BY = URI.create("https://example.org/model/knownBy");
  private static final URI SUPPLIER = URI.create("https://example.org/model/Supplier");
  private static final String SKOSXL = "http://www.w3.org/2008/05/skos-xl#";

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

  @Test
  void skosExportListsBroaderForEveryParentAndSkosXlGivesEveryLabelItsOwnNode(TestNamespace ns) {
    var client = SdkClients.adminClient();
    Ontology ontology = createOntology(ns, "skos");
    client
        .ontologyConcepts()
        .create(
            new CreateOntologyConcept()
                .withName("Customer")
                .withDisplayName("Customer account")
                .withIri(CUSTOMER)
                .withConceptType(OntologyConceptType.OWL_CLASS)
                .withSynonyms(Set.of("Client", "Buyer"))
                .withOntology(ontology.getFullyQualifiedName()));
    declareClass(ontology, "Party", PARTY);
    declareClass(ontology, "Supplier", SUPPLIER);
    client.ontologyAxioms().create(axiom(ontology));
    client
        .ontologyAxioms()
        .create(axiom(ontology).withName("supplier-is-party").withSubjectIri(SUPPLIER));
    OntologyRelease release = capture(ontology);

    Model skos = parseTurtle(export(client, release.getId(), "skos"));
    for (URI child : List.of(CUSTOMER, SUPPLIER)) {
      assertTrue(
          skos.contains(
              skos.createResource(child.toString()),
              SKOS.broader,
              skos.createResource(PARTY.toString())));
    }
    assertTrue(skos.contains(skos.createResource(PARTY.toString()), RDF.type, SKOS.Concept));
    assertEquals(
        3,
        skos.listResourcesWithProperty(SKOS.inScheme).toList().size(),
        "every concept is in the scheme");
    assertFalse(skos.contains(null, skos.createProperty(SKOSXL + "literalForm")));

    Model skosXl = parseTurtle(export(client, release.getId(), "skos-xl"));
    var labelType = skosXl.createResource(SKOSXL + "Label");
    var labels = skosXl.listResourcesWithProperty(RDF.type, labelType).toList();
    assertEquals(5, labels.size(), "three concept labels plus two synonyms");
    var customerLabel =
        skosXl
            .getResource(CUSTOMER.toString())
            .getPropertyResourceValue(skosXl.createProperty(SKOSXL + "prefLabel"));
    assertEquals(
        "Customer account",
        customerLabel.getProperty(skosXl.createProperty(SKOSXL + "literalForm")).getString());
    assertEquals(
        2,
        skosXl
            .listObjectsOfProperty(
                skosXl.getResource(CUSTOMER.toString()), skosXl.createProperty(SKOSXL + "altLabel"))
            .toList()
            .size());
  }

  @Test
  void csvExportParsesBackThroughTheNativeCodecAndHonoursInverses(TestNamespace ns) {
    var client = SdkClients.adminClient();
    Ontology ontology = createOntology(ns, "csv");
    declareClass(ontology, "Customer", CUSTOMER);
    declareClass(ontology, "Party", PARTY);
    client.ontologyAxioms().create(axiom(ontology));
    client.ontologyProperties().create(property(ontology).withInverse(KNOWN_BY));
    client.ontologyProperties().create(inverseProperty(ontology));
    OntologyRelease release = capture(ontology);

    var withInverses = NativeOntologyCsvCodec.read(export(client, release.getId(), "csv"));
    var withoutInverses =
        NativeOntologyCsvCodec.read(
            export(client, release.getId(), "csv", "&includeInverses=false"));

    assertEquals(
        List.of(CUSTOMER.toString(), PARTY.toString()),
        withInverses.concepts().stream().map(c -> c.getIri().toString()).toList());
    assertEquals(
        List.of(KNOWN_BY, KNOWS),
        withInverses.properties().stream().map(property -> property.getIri()).sorted().toList());
    assertTrue(withInverses.properties().stream().allMatch(p -> p.getInverse() != null));
    assertTrue(withoutInverses.properties().stream().allMatch(p -> p.getInverse() == null));
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> export(client, release.getId(), "csv", "&includeBoundAssets=true"))
            .getStatusCode());
  }

  @Test
  void inverseOfIsWrittenOnlyWhenRequested(TestNamespace ns) {
    var client = SdkClients.adminClient();
    Ontology ontology = createOntology(ns, "inverses");
    declareClass(ontology, "Customer", CUSTOMER);
    declareClass(ontology, "Party", PARTY);
    client.ontologyProperties().create(property(ontology).withInverse(KNOWN_BY));
    client.ontologyProperties().create(inverseProperty(ontology));
    OntologyRelease release = capture(ontology);

    Model with = parseTurtle(export(client, release.getId(), "turtle"));
    Model without =
        parseTurtle(export(client, release.getId(), "turtle", "&includeInverses=false"));

    assertTrue(with.contains(with.createResource(KNOWS.toString()), OWL2.inverseOf));
    assertFalse(without.contains(null, OWL2.inverseOf));
    assertTrue(
        without.contains(without.createResource(KNOWS.toString()), RDF.type, OWL2.ObjectProperty));
  }

  @Test
  void boundAssetsAreLinkedOncePerBindingAndOnlyWhenRequested(TestNamespace ns) {
    var client = SdkClients.adminClient();
    Ontology ontology = createOntology(ns, "assets");
    var customer = declareClass(ontology, "Customer", CUSTOMER);
    declareClass(ontology, "Party", PARTY);
    var schema = DatabaseSchemaTestFactory.createSimple(ns);
    var first = table(ns, schema.getFullyQualifiedName(), "boundOne");
    var second = table(ns, schema.getFullyQualifiedName(), "boundTwo");
    bind(client, customer, first.getId(), 0L);
    bind(client, customer, second.getId(), 1L);
    OntologyRelease release = capture(ontology);

    Model linked =
        parseTurtle(export(client, release.getId(), "turtle", "&includeBoundAssets=true"));
    Model plain = parseTurtle(export(client, release.getId(), "turtle"));

    var property = linked.createProperty("https://open-metadata.org/ontology/boundAsset");
    assertEquals(
        Set.of(
            "https://open-metadata.org/entity/table/" + first.getId(),
            "https://open-metadata.org/entity/table/" + second.getId()),
        linked
            .listObjectsOfProperty(linked.getResource(CUSTOMER.toString()), property)
            .toList()
            .stream()
            .map(Object::toString)
            .collect(Collectors.toSet()));
    assertEquals(2, linked.listStatements(null, property, (RDFNode) null).toList().size());
    assertFalse(plain.contains(null, plain.createProperty(property.getURI())));
  }

  @Test
  void shaclGateExportsAValidReleaseUnchanged(TestNamespace ns) {
    var client = SdkClients.adminClient();
    Ontology ontology = createOntology(ns, "gate");
    declareClass(ontology, "Customer", CUSTOMER);
    OntologyRelease release = capture(ontology);

    assertEquals(
        export(client, release.getId(), "turtle"),
        export(client, release.getId(), "turtle", "&shaclGate=true"));
    assertTrue(
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/ontologyReleases/" + release.getId() + "/validation",
                null,
                OntologyReleaseValidation.class)
            .getValid());
  }

  @Test
  void anExportCarriesOnlyTheReleasesOntology(TestNamespace ns) {
    var client = SdkClients.adminClient();
    Ontology current = createOntology(ns, "scopeCurrent");
    declareClass(current, "Customer", CUSTOMER);
    Ontology other = createOntology(ns, "scopeOther");
    declareClass(other, "Party", PARTY);
    OntologyRelease release = capture(current);
    capture(other);

    for (String format : List.of("turtle", "skos", "skos-xl")) {
      Model model = parseTurtle(export(client, release.getId(), format));
      assertTrue(model.containsResource(model.createResource(CUSTOMER.toString())), format);
      assertFalse(model.containsResource(model.createResource(PARTY.toString())), format);
    }
    var csv = NativeOntologyCsvCodec.read(export(client, release.getId(), "csv"));
    assertEquals(
        List.of(CUSTOMER.toString()),
        csv.concepts().stream().map(c -> c.getIri().toString()).toList());
  }

  private static CreateOntologyProperty inverseProperty(Ontology ontology) {
    return new CreateOntologyProperty()
        .withName("knownBy")
        .withIri(KNOWN_BY)
        .withKind(OntologyPropertyKind.OBJECT)
        .withDomain(List.of(PARTY))
        .withRange(List.of(CUSTOMER))
        .withInverse(KNOWS)
        .withOntology(ontology.getFullyQualifiedName());
  }

  private static Table table(TestNamespace ns, String schemaFqn, String name) {
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.prefix(name))
                .withDatabaseSchema(schemaFqn)
                .withColumns(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.STRING))));
  }

  private static void bind(
      OpenMetadataClient client, OntologyConcept concept, UUID tableId, long revision) {
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/ontologyConcepts/" + concept.getId() + "/bindings",
            new UpdateOntologyConceptBinding()
                .withExpectedRevision(revision)
                .withAsset(
                    new OntologyAssetBinding()
                        .withAssetType(OntologyBindingAssetType.TABLE)
                        .withAssetId(tableId)),
            OntologyConceptBindingsResponse.class);
  }

  private static Model parseTurtle(String text) {
    Model model = ModelFactory.createDefaultModel();
    RDFParser.fromString(text, Lang.TURTLE).parse(model);
    return model;
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
    return export(client, releaseId, format, "");
  }

  private static String export(
      OpenMetadataClient client, UUID releaseId, String format, String options) {
    return client
        .getHttpClient()
        .executeForString(
            HttpMethod.GET,
            "/v1/ontologyReleases/" + releaseId + "/export?format=" + format + options,
            null,
            RequestOptions.builder().header("Accept", "*/*").build());
  }
}
