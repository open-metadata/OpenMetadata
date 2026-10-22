package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.Map;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFParser;
import org.apache.jena.vocabulary.OWL2;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.OntologyChangeSetTestSupport;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.ontology.OntologyPropertyService;

/**
 * A native object property's {@code inverse} is reciprocal: whichever side states it, both sides
 * carry it, and clearing or deleting one side releases the other.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyInverseIT extends BaseOntologyApprovalIT {
  private static final URI PART_OF = URI.create("https://open-metadata.org/ontology/partOf");
  private static final URI HAS_PART = URI.create("https://open-metadata.org/ontology/hasPart");
  private static final URI CONTAINED_IN = URI.create("https://example.org/model/containedIn");
  private static final URI CUSTOMER = URI.create("https://example.org/model/Customer");
  private static final URI ACCOUNT = URI.create("https://example.org/model/Account");
  private static final String PREFIXES =
      """
      @prefix om: <https://open-metadata.org/ontology/> .
      @prefix owl: <http://www.w3.org/2002/07/owl#> .
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
      """;
  private static final String ONE_DIRECTION =
      PREFIXES
          + """
          om:partOf a owl:ObjectProperty ; rdfs:label "part of" ; owl:inverseOf om:hasPart .
          om:hasPart a owl:ObjectProperty ; rdfs:label "has part" .
          """;
  private static final String BOTH_DIRECTIONS =
      PREFIXES
          + """
          om:partOf a owl:ObjectProperty ; rdfs:label "part of" ; owl:inverseOf om:hasPart .
          om:hasPart a owl:ObjectProperty ; rdfs:label "has part" ; owl:inverseOf om:partOf .
          """;

  @Test
  void settingAnInverseWritesTheReciprocalSide(TestNamespace ns) {
    Ontology ontology = createOntology(ns, "inverseModel");
    OntologyPropertyService service = SdkClients.adminClient().ontologyProperties();
    OntologyProperty partOf = service.create(objectProperty(ontology, "partOf", PART_OF));
    OntologyProperty hasPart = service.create(objectProperty(ontology, "hasPart", HAS_PART));
    long before =
        SdkClients.adminClient().ontologies().state(ontology.getId()).getWorkingRevision();

    OntologyProperty linked = service.patch(partOf.getId(), inversePatch(HAS_PART));

    assertEquals(HAS_PART, linked.getInverse());
    assertEquals(PART_OF, service.get(hasPart.getId().toString()).getInverse());
    long after = SdkClients.adminClient().ontologies().state(ontology.getId()).getWorkingRevision();
    assertTrue(after > before, "the reciprocal write lands in the working state");
    service.patch(partOf.getId(), inversePatch(HAS_PART));
    assertEquals(PART_OF, service.get(hasPart.getId().toString()).getInverse());
  }

  @Test
  void creatingWithAnInverseLinksTheExistingPartner(TestNamespace ns) {
    Ontology ontology = createOntology(ns, "inverseModel");
    OntologyPropertyService service = SdkClients.adminClient().ontologyProperties();
    OntologyProperty hasPart = service.create(objectProperty(ontology, "hasPart", HAS_PART));

    OntologyProperty partOf =
        service.create(objectProperty(ontology, "partOf", PART_OF).withInverse(HAS_PART));

    assertEquals(HAS_PART, partOf.getInverse());
    assertEquals(PART_OF, service.get(hasPart.getId().toString()).getInverse());
  }

  @Test
  void repointingAnInverseReleasesTheOldPartner(TestNamespace ns) {
    Ontology ontology = createOntology(ns, "inverseModel");
    OntologyPropertyService service = SdkClients.adminClient().ontologyProperties();
    OntologyProperty hasPart = service.create(objectProperty(ontology, "hasPart", HAS_PART));
    OntologyProperty partOf =
        service.create(objectProperty(ontology, "partOf", PART_OF).withInverse(HAS_PART));
    OntologyProperty containedIn =
        service.create(objectProperty(ontology, "containedIn", CONTAINED_IN));

    service.patch(partOf.getId(), inversePatch(CONTAINED_IN));

    assertNull(service.get(hasPart.getId().toString()).getInverse());
    assertEquals(PART_OF, service.get(containedIn.getId().toString()).getInverse());
  }

  @Test
  void clearingOneSideClearsTheOther(TestNamespace ns) {
    Ontology ontology = createOntology(ns, "inverseModel");
    OntologyPropertyService service = SdkClients.adminClient().ontologyProperties();
    OntologyProperty hasPart = service.create(objectProperty(ontology, "hasPart", HAS_PART));
    OntologyProperty partOf =
        service.create(objectProperty(ontology, "partOf", PART_OF).withInverse(HAS_PART));

    service.patch(partOf.getId(), removeInversePatch());

    assertNull(service.get(partOf.getId().toString()).getInverse());
    assertNull(service.get(hasPart.getId().toString()).getInverse());
  }

  @Test
  void deletingOneSideClearsTheOtherAndRestoreRelinksIt(TestNamespace ns) {
    Ontology ontology = createOntology(ns, "inverseModel");
    OntologyPropertyService service = SdkClients.adminClient().ontologyProperties();
    OntologyProperty hasPart = service.create(objectProperty(ontology, "hasPart", HAS_PART));
    OntologyProperty partOf =
        service.create(objectProperty(ontology, "partOf", PART_OF).withInverse(HAS_PART));

    service.delete(hasPart.getId().toString());
    assertNull(service.get(partOf.getId().toString()).getInverse());

    OntologyProperty restored = service.restore(hasPart.getId());
    assertEquals(PART_OF, restored.getInverse());
    assertEquals(HAS_PART, service.get(partOf.getId().toString()).getInverse());

    service.delete(partOf.getId().toString(), Map.of("hardDelete", "true"));
    assertNull(service.get(hasPart.getId().toString()).getInverse());
  }

  @Test
  void oneDirectionalImportIsNormalizedOnApplyAndReusedByIri(TestNamespace ns) {
    Ontology ontology = createOntology(ns, "importedInverses");
    OpenMetadataClient client = SdkClients.adminClient();
    CreateOntologyChangeSet preview =
        client.ontologies().previewImport(ontology.getId(), turtle(ONE_DIRECTION));
    OntologyChangeSet draft =
        ns.trackRoot(
            "ontologyChangeSet",
            client.ontologyChangeSets().create(preview.withName(ns.prefix("inverseImport"))));

    OntologyChangeSet applied =
        OntologyChangeSetTestSupport.applyOntologyChangeSet(client, draft, ns, "inverseEditor");

    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertEquals(HAS_PART, propertyByIri(client, ontology, PART_OF).getInverse());
    assertEquals(PART_OF, propertyByIri(client, ontology, HAS_PART).getInverse());
    assertTrue(
        client
            .ontologies()
            .previewImport(ontology.getId(), turtle(BOTH_DIRECTIONS))
            .getOperations()
            .isEmpty(),
        "a second import matches both properties by their exact IRIs");
    OpenMetadataException duplicate =
        assertThrows(
            OpenMetadataException.class,
            () -> client.ontologyProperties().create(objectProperty(ontology, "partOf2", PART_OF)));
    assertEquals(409, duplicate.getStatusCode());
  }

  @Test
  void exportLinksThePairWithOwlInverseOf(TestNamespace ns) {
    Ontology ontology = createOntology(ns, "exportedInverses");
    declareClass(ontology, "Customer", CUSTOMER);
    declareClass(ontology, "Account", ACCOUNT);
    OntologyPropertyService service = SdkClients.adminClient().ontologyProperties();
    service.create(objectProperty(ontology, "hasPart", HAS_PART));
    service.create(objectProperty(ontology, "partOf", PART_OF).withInverse(HAS_PART));
    OntologyRelease release = capture(ontology);

    Model model = ModelFactory.createDefaultModel();
    RDFParser.fromString(export(release.getId()), Lang.TURTLE).parse(model);

    assertTrue(
        model.contains(
            model.createResource(PART_OF.toString()),
            OWL2.inverseOf,
            model.createResource(HAS_PART.toString())));
    assertTrue(
        model.contains(
            model.createResource(HAS_PART.toString()),
            OWL2.inverseOf,
            model.createResource(PART_OF.toString())));
  }

  private static CreateOntologyProperty objectProperty(Ontology ontology, String name, URI iri) {
    return new CreateOntologyProperty()
        .withName(name)
        .withOntology(ontology.getFullyQualifiedName())
        .withKind(OntologyPropertyKind.OBJECT)
        .withIri(iri);
  }

  private static JsonNode inversePatch(URI inverse) {
    return JsonUtils.readTree(
        "[{\"op\":\"add\",\"path\":\"/inverse\",\"value\":\"%s\"}]".formatted(inverse));
  }

  private static JsonNode removeInversePatch() {
    return JsonUtils.readTree("[{\"op\":\"remove\",\"path\":\"/inverse\"}]");
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

  private static PreviewNativeOntologyImport turtle(String data) {
    return new PreviewNativeOntologyImport()
        .withFormat(PreviewNativeOntologyImport.Format.TURTLE)
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
