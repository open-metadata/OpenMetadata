package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFParser;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.OntologyChangeSetTestSupport;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.api.data.NativeOntologyImportFormat;
import org.openmetadata.schema.api.data.NativeOntologyImportPreview;
import org.openmetadata.schema.api.data.NativeOntologyImportSkipReason;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.ontology.OntologyPropertyService;

/**
 * A native property specializes other properties through {@code superProperties}
 * (ADR:2026-11-07-ontology-property-hierarchies-are-superproperty-fields): the links are indexed,
 * must name declared properties of the same kind, follow the OWL 2 DL simplicity rules, and
 * survive import, export and re-import.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyPropertyHierarchyIT extends BaseOntologyApprovalIT {
  private static final String EX = "https://example.org/model/";
  private static final URI HAS_RELATIVE = URI.create(EX + "hasRelative");
  private static final URI HAS_CHILD = URI.create(EX + "hasChild");
  private static final URI HAS_ANCESTOR = URI.create(EX + "hasAncestor");
  private static final URI CODE = URI.create(EX + "code");
  private static final URI NOTE = URI.create(EX + "note");
  private static final String HIERARCHY =
      """
      @prefix ex: <https://example.org/model/> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      ex:hasRelative a owl:ObjectProperty ; rdfs:label "has relative" .
      ex:hasChild a owl:ObjectProperty ; rdfs:label "has child" ;
        rdfs:subPropertyOf ex:hasRelative , <https://other.example/related> .
      ex:code a owl:DatatypeProperty ; rdfs:label "code" ; rdfs:subPropertyOf owl:topDataProperty .
      ex:note a owl:AnnotationProperty ; rdfs:label "note" ; rdfs:subPropertyOf rdfs:comment .
      """;

  @Test
  void superpropertyLinksAreStoredIndexedAndReleasedWithTheLink(TestNamespace ns) {
    final Ontology ontology = createOntology(ns, "propertyHierarchy");
    final OntologyPropertyService service = SdkClients.adminClient().ontologyProperties();
    final OntologyProperty hasRelative =
        service.create(property(ontology, "hasRelative", HAS_RELATIVE));

    final OntologyProperty hasChild =
        service.create(
            property(ontology, "hasChild", HAS_CHILD).withSuperProperties(List.of(HAS_RELATIVE)));

    assertEquals(List.of(HAS_RELATIVE), hasChild.getSuperProperties());
    assertEquals(
        List.of(HAS_RELATIVE), service.get(hasChild.getId().toString()).getSuperProperties());
    final JsonNode indexed = references(ontology, HAS_RELATIVE);
    assertEquals(1, indexed.path("paging").path("total").asInt());
    assertEquals("SUPER_PROPERTY", indexed.path("data").get(0).path("role").asText());
    assertEquals(
        hasChild.getId().toString(),
        indexed.path("data").get(0).path("source").path("id").asText());

    final OpenMetadataException held =
        assertThrows(
            OpenMetadataException.class, () -> service.delete(hasRelative.getId().toString()));
    assertEquals(400, held.getStatusCode());
    assertTrue(held.getMessage().contains(HAS_RELATIVE.toString()), held.getMessage());

    service.patch(hasChild.getId(), superPropertiesPatch());
    assertEquals(List.of(), service.get(hasChild.getId().toString()).getSuperProperties());
    assertEquals(0, references(ontology, HAS_RELATIVE).path("paging").path("total").asInt());
    service.delete(hasRelative.getId().toString());
  }

  @Test
  void aSuperpropertyIsADeclaredPropertyOfTheSameKindAndNeverThePropertyItself(TestNamespace ns) {
    final Ontology ontology = createOntology(ns, "propertyHierarchy");
    final OntologyPropertyService service = SdkClients.adminClient().ontologyProperties();
    final OntologyProperty hasChild = service.create(property(ontology, "hasChild", HAS_CHILD));
    service.create(property(ontology, "code", CODE).withKind(OntologyPropertyKind.DATA));
    final long revision =
        SdkClients.adminClient().ontologies().state(ontology.getId()).getWorkingRevision();

    assertRefused(
        service,
        hasChild,
        superPropertiesPatch(CODE),
        "The referenced property must have kind OBJECT: " + CODE);
    assertRefused(
        service,
        hasChild,
        superPropertiesPatch(URI.create(EX + "undeclared")),
        "Declare or import the referenced property: " + EX + "undeclared");
    assertRefused(
        service,
        hasChild,
        superPropertiesPatch(HAS_CHILD),
        "A property cannot be its own superproperty");

    assertEquals(List.of(), service.get(hasChild.getId().toString()).getSuperProperties());
    assertEquals(
        revision,
        SdkClients.adminClient().ontologies().state(ontology.getId()).getWorkingRevision());
  }

  @Test
  void aCompositePropertyAndItsSuperpropertiesStaySimpleOnlyWhereOwl2DlAllows(TestNamespace ns) {
    final Ontology ontology = createOntology(ns, "propertyHierarchy");
    final OntologyPropertyService service = SdkClients.adminClient().ontologyProperties();
    final OntologyProperty hasRelative =
        service.create(
            property(ontology, "hasRelative", HAS_RELATIVE)
                .withCharacteristics(Set.of(RelationshipCharacteristic.FUNCTIONAL)));
    final OntologyProperty hasAncestor =
        service.create(
            property(ontology, "hasAncestor", HAS_ANCESTOR)
                .withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE)));

    assertRefused(
        service,
        hasAncestor,
        superPropertiesPatch(HAS_RELATIVE),
        "A non-simple object property cannot specialize a functional, inverse-functional, asymmetric, irreflexive or disjoint property: "
            + HAS_RELATIVE);

    service.patch(hasRelative.getId(), characteristicsPatch());
    service.patch(hasAncestor.getId(), superPropertiesPatch(HAS_RELATIVE));
    assertEquals(
        List.of(HAS_RELATIVE), service.get(hasAncestor.getId().toString()).getSuperProperties());
    assertRefused(
        service,
        hasRelative,
        characteristicsPatch(RelationshipCharacteristic.FUNCTIONAL),
        "A non-simple object property cannot be functional, inverse-functional, asymmetric, irreflexive or disjoint");
  }

  @Test
  void superpropertyLinksMustNotFormACycle(TestNamespace ns) {
    final Ontology ontology = createOntology(ns, "propertyHierarchy");
    final OntologyPropertyService service = SdkClients.adminClient().ontologyProperties();
    final OntologyProperty hasRelative =
        service.create(property(ontology, "hasRelative", HAS_RELATIVE));
    final OntologyProperty hasChild =
        service.create(
            property(ontology, "hasChild", HAS_CHILD).withSuperProperties(List.of(HAS_RELATIVE)));

    assertRefused(
        service,
        hasRelative,
        superPropertiesPatch(HAS_CHILD),
        "Superproperty links must not form a cycle: " + HAS_RELATIVE);
    assertEquals(List.of(), service.get(hasRelative.getId().toString()).getSuperProperties());
    assertEquals(
        List.of(HAS_RELATIVE), service.get(hasChild.getId().toString()).getSuperProperties());
  }

  @Test
  void importedHierarchiesOfEveryKindExportAndReimportWithoutLoss(TestNamespace ns) {
    final Ontology ontology = createOntology(ns, "importedHierarchy");
    final OpenMetadataClient client = SdkClients.adminClient();

    final NativeOntologyImportPreview preview =
        client.ontologies().previewImport(ontology.getId(), turtle(HIERARCHY));

    assertEquals(4, preview.getSummary().getCounts().getNewProperties());
    final var skipped = preview.getSummary().getSkippedStatements();
    assertEquals(1, skipped.getTotal(), skipped.toString());
    assertEquals(
        NativeOntologyImportSkipReason.UNDECLARED_REFERENCE,
        skipped.getGroups().getFirst().getReason());
    assertEquals(RDFS.subPropertyOf.getURI(), skipped.getGroups().getFirst().getPredicate());
    final OntologyChangeSet draft =
        ns.trackRoot(
            "ontologyChangeSet",
            client
                .ontologyChangeSets()
                .create(preview.getChangeSet().withName(ns.prefix("hierarchyImport"))));
    final OntologyChangeSet applied =
        OntologyChangeSetTestSupport.applyOntologyChangeSet(client, draft, ns, "hierarchyEditor");
    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertEquals(
        List.of(HAS_RELATIVE), propertyByIri(client, ontology, HAS_CHILD).getSuperProperties());
    assertEquals(
        List.of(URI.create(OWL2.topDataProperty.getURI())),
        propertyByIri(client, ontology, CODE).getSuperProperties());
    assertEquals(
        List.of(URI.create(RDFS.comment.getURI())),
        propertyByIri(client, ontology, NOTE).getSuperProperties());

    final OntologyRelease release = capture(ontology);
    final String exported = export(release.getId());
    final Model model = ModelFactory.createDefaultModel();
    RDFParser.fromString(exported, Lang.TURTLE).parse(model);
    assertTrue(
        model.contains(
            resource(model, HAS_CHILD), RDFS.subPropertyOf, resource(model, HAS_RELATIVE)));
    assertTrue(model.contains(resource(model, CODE), RDFS.subPropertyOf, OWL2.topDataProperty));
    assertTrue(model.contains(resource(model, NOTE), RDFS.subPropertyOf, RDFS.comment));

    final NativeOntologyImportPreview again =
        client.ontologies().previewImport(ontology.getId(), turtle(exported));
    assertEquals(List.of(), again.getChangeSet().getOperations());
    assertEquals(0, again.getSummary().getSkippedStatements().getTotal());
  }

  private static void assertRefused(
      OntologyPropertyService service, OntologyProperty property, JsonNode patch, String message) {
    final OpenMetadataException refused =
        assertThrows(OpenMetadataException.class, () -> service.patch(property.getId(), patch));
    assertEquals(400, refused.getStatusCode());
    assertTrue(refused.getMessage().contains(message), refused.getMessage());
  }

  private static CreateOntologyProperty property(Ontology ontology, String name, URI iri) {
    return new CreateOntologyProperty()
        .withName(name)
        .withOntology(ontology.getFullyQualifiedName())
        .withKind(OntologyPropertyKind.OBJECT)
        .withIri(iri);
  }

  private static JsonNode superPropertiesPatch(URI... superProperties) {
    return JsonUtils.readTree(
        "[{\"op\":\"add\",\"path\":\"/superProperties\",\"value\":"
            + JsonUtils.pojoToJson(List.of(superProperties))
            + "}]");
  }

  private static JsonNode characteristicsPatch(RelationshipCharacteristic... characteristics) {
    return JsonUtils.readTree(
        "[{\"op\":\"add\",\"path\":\"/characteristics\",\"value\":"
            + JsonUtils.pojoToJson(List.of(characteristics))
            + "}]");
  }

  private static JsonNode references(Ontology ontology, URI iri) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/ontologies/"
                + ontology.getId()
                + "/references?iri="
                + URLEncoder.encode(iri.toString(), StandardCharsets.UTF_8),
            null,
            JsonNode.class);
  }

  private static OntologyProperty propertyByIri(
      OpenMetadataClient client, Ontology ontology, URI iri) {
    return client
        .ontologyProperties()
        .list(new ListParams().addFilter("ontology", ontology.getFullyQualifiedName()))
        .getData()
        .stream()
        .filter(property -> iri.equals(property.getIri()))
        .findFirst()
        .orElseThrow();
  }

  private static org.apache.jena.rdf.model.Resource resource(Model model, URI iri) {
    return model.createResource(iri.toString());
  }

  private static PreviewNativeOntologyImport turtle(String data) {
    return new PreviewNativeOntologyImport()
        .withFormat(NativeOntologyImportFormat.TURTLE)
        .withData(data);
  }

  private static String export(UUID releaseId) {
    return SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.GET,
            "/v1/ontologyReleases/" + releaseId + "/export?format=turtle",
            null,
            RequestOptions.builder().header("Accept", "*/*").build());
  }
}
