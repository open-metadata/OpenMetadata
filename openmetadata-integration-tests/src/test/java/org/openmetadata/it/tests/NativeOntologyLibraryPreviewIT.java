package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.OntologyChangeSetTestSupport;
import org.openmetadata.it.util.RdfAccessFixtures;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.api.data.NativeOntologyImportItemStatus;
import org.openmetadata.schema.api.data.NativeOntologyImportSummary;
import org.openmetadata.schema.api.data.OntologyPackList;
import org.openmetadata.schema.api.data.OntologyPackSample;
import org.openmetadata.schema.api.data.PreviewNativeOntologyPack;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class NativeOntologyLibraryPreviewIT extends BaseOntologyApprovalIT {
  @Test
  void librarySummaryBoundsLargePacksWithoutReturningDraftOperations(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var client = SdkClients.adminClient();
    final long revision = client.ontologies().state(ontology.getId()).getWorkingRevision();
    final JsonNode summary =
        client
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                "/v1/ontologies/" + ontology.getId() + "/library/fibo/summary",
                new PreviewNativeOntologyPack().withModuleIds(Set.of("fibo-quickstart")),
                JsonNode.class);

    assertFalse(summary.has("changeSet"));
    assertFalse(summary.has("operations"));
    assertEquals(2413, summary.path("counts").path("newConcepts").asInt());
    assertEquals(5000, summary.path("items").size());
    assertTrue(summary.path("omittedItems").asInt() > 0);
    assertEquals(revision, client.ontologies().state(ontology.getId()).getWorkingRevision());
  }

  @Test
  void librarySummaryReconcilesCachedContentAgainstTheCurrentDraft(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var client = SdkClients.adminClient();
    final String iri = "http://www.w3.org/ns/dcat#Catalog";
    final NativeOntologyImportSummary before = summary(client, ontology);
    assertTrue(
        before.getItems().stream()
            .anyMatch(
                item ->
                    iri.equals(item.getIri())
                        && item.getStatus() == NativeOntologyImportItemStatus.NEW));
    declareClass(ontology, "ExistingCatalog", URI.create(iri));

    final NativeOntologyImportSummary after = summary(client, ontology);

    assertEquals(before.getCounts().getNewConcepts() - 1, after.getCounts().getNewConcepts());
    assertTrue(
        after.getItems().stream()
            .anyMatch(
                item ->
                    iri.equals(item.getIri())
                        && item.getStatus() == NativeOntologyImportItemStatus.UPDATE));
  }

  @Test
  void librarySummaryAuthorizesWorkingDefinitionsAfterTheSourceCacheIsWarm(TestNamespace ns) {
    final var ontology = createOntology(ns);
    declareClass(ontology, "Private", URI.create("https://example.org/private"));
    assertFalse(summary(SdkClients.adminClient(), ontology).getItems().isEmpty());
    try (RdfAccessFixtures fixtures = new RdfAccessFixtures("summary" + ns.shortPrefix())) {
      final var role = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.ONTOLOGY_CONCEPT);
      final String token = fixtures.userToken("reader", List.of(role.getId()));
      final var denied =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(token)
                  .build());

      assertEquals(
          403,
          assertThrows(OpenMetadataException.class, () -> summary(denied, ontology))
              .getStatusCode());
    }
  }

  @Test
  void libraryPreviewCannotReadDeniedWorkingDefinitions(TestNamespace ns) {
    final var ontology = createOntology(ns);
    SdkClients.adminClient()
        .ontologyConcepts()
        .create(
            new CreateOntologyConcept()
                .withName("Private")
                .withConceptType(OntologyConceptType.OWL_CLASS)
                .withOntology(ontology.getFullyQualifiedName()));
    try (RdfAccessFixtures fixtures = new RdfAccessFixtures("library" + ns.shortPrefix())) {
      final var role = fixtures.denyRole(MetadataOperation.VIEW_ALL, Entity.ONTOLOGY_CONCEPT);
      final String token = fixtures.userToken("reader", List.of(role.getId()));
      final var denied =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(token)
                  .build());
      assertEquals(
          403,
          assertThrows(
                  OpenMetadataException.class,
                  () ->
                      denied
                          .getHttpClient()
                          .execute(
                              HttpMethod.POST,
                              "/v1/ontologies/" + ontology.getId() + "/library/dcat/preview",
                              new PreviewNativeOntologyPack().withModuleIds(Set.of("dcat")),
                              CreateOntologyChangeSet.class))
              .getStatusCode());
    }
  }

  private static final Map<String, Integer> PACK_OPERATIONS =
      Map.ofEntries(
          Map.entry("brick", 11810),
          Map.entry("dcat", 48),
          Map.entry("dpv", 3688),
          Map.entry("epcis", 199),
          Map.entry("fhir", 16404),
          Map.entry("fibo", 9901),
          Map.entry("foaf", 100),
          Map.entry("gs1", 1071),
          Map.entry("hr-open", 14),
          Map.entry("iof", 2642),
          Map.entry("isa-95", 16),
          Map.entry("odrl", 756),
          Map.entry("org", 50),
          Map.entry("owl-time", 208),
          Map.entry("prov-o", 130),
          Map.entry("sosa-ssn", 144));

  @Test
  void everyPackPreviewsWithoutChangingTheTarget(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final var packs =
        client
            .getHttpClient()
            .execute(HttpMethod.GET, "/v1/ontologyPacks", null, OntologyPackList.class);
    final Set<String> previewed = new HashSet<>();
    final Map<String, Integer> actual = new TreeMap<>();
    for (final var pack : packs.getPacks()) {
      final var ontology = createOntology(ns, "library_" + pack.getId());
      final long before = client.ontologies().state(ontology.getId()).getWorkingRevision();
      final Set<String> modules =
          pack.getModules().stream().map(module -> module.getId()).collect(Collectors.toSet());
      final var plan = preview(ontology, pack.getId(), modules);
      actual.put(pack.getId(), plan.getOperations().size());
      assertEquals(before, plan.getBaseWorkingRevision());
      assertEquals(before, client.ontologies().state(ontology.getId()).getWorkingRevision());
      previewed.add(pack.getId());
    }
    assertEquals(new TreeMap<>(PACK_OPERATIONS), actual);
    assertEquals(PACK_OPERATIONS.keySet(), previewed);
  }

  @Test
  void selectedSsnModuleIncludesSosaAndAppliesThroughANativeDraft(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var client = SdkClients.adminClient();
    final var plan = preview(ontology, "sosa-ssn", Set.of("ssn"));
    assertEquals("sosa-ssn", plan.getSourcePack().getPackId());
    assertEquals(List.of("sosa", "ssn"), new ArrayList<>(plan.getSourcePack().getModuleIds()));
    assertEquals(144, plan.getOperations().size());
    assertEquals(22, countOf(plan, OntologyChangeOperationType.UPSERT_CONCEPT));
    assertEquals(49, countOf(plan, OntologyChangeOperationType.UPSERT_PROPERTY));
    assertEquals(73, countOf(plan, OntologyChangeOperationType.UPSERT_AXIOM));
    assertEquals(
        Set.of(
            "http://purl.org/vocommons/voaf#Vocabulary",
            "http://www.w3.org/2006/time#TemporalEntity",
            "http://xmlns.com/foaf/0.1/Agent"),
        plan.getOperations().stream()
            .filter(
                operation ->
                    operation.getOperationType() == OntologyChangeOperationType.UPSERT_CONCEPT)
            .map(operation -> operation.getConcept().getIri().toString())
            .filter(iri -> !iri.startsWith("http://www.w3.org/ns/"))
            .collect(Collectors.toSet()),
        "concepts outside the W3C namespace are the ones SOSA/SSN itself declares");
    final var draft =
        ns.trackRoot(
            "ontologyChangeSet",
            client.ontologyChangeSets().create(plan.withName(ns.prefix("libraryDraft"))));
    final var applied =
        OntologyChangeSetTestSupport.applyOntologyChangeSet(client, draft, ns, "libraryEditor");
    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertEquals(144, applied.getApplicationResult().getOperationsApplied());
    assertEquals(0, preview(ontology, "sosa-ssn", Set.of("ssn")).getOperations().size());
  }

  @Test
  void sampleFollowsTheSelectedModulesWithoutATarget() {
    final var client = SdkClients.adminClient();
    final var both =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/ontologyPacks/sosa-ssn/sample?moduleIds=sosa,ssn",
                null,
                OntologyPackSample.class);
    assertEquals(22, both.getConceptCount());
    assertTrue(both.getConcepts().size() <= 60);
    assertTrue(both.getConcepts().stream().allMatch(concept -> concept.getLabel() != null));
    assertFalse(both.getRelations().isEmpty(), "the class hierarchy is drawn as relations");
    final var sosa =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/ontologyPacks/sosa-ssn/sample?moduleIds=sosa",
                null,
                OntologyPackSample.class);
    assertEquals(16, sosa.getConceptCount());
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () ->
                    client
                        .getHttpClient()
                        .execute(
                            HttpMethod.GET,
                            "/v1/ontologyPacks/sosa-ssn/sample?moduleIds=missing",
                            null,
                            OntologyPackSample.class))
            .getStatusCode());
  }

  private static long countOf(
      final CreateOntologyChangeSet plan, final OntologyChangeOperationType type) {
    return plan.getOperations().stream()
        .filter(operation -> operation.getOperationType() == type)
        .count();
  }

  @Test
  void invalidSelectionsCannotChangeTheOntology(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var client = SdkClients.adminClient();
    final long before = client.ontologies().state(ontology.getId()).getWorkingRevision();
    for (final var body :
        Arrays.asList(null, new PreviewNativeOntologyPack().withModuleIds(null))) {
      assertEquals(
          400,
          assertThrows(
                  OpenMetadataException.class,
                  () ->
                      client
                          .getHttpClient()
                          .execute(
                              HttpMethod.POST,
                              "/v1/ontologies/" + ontology.getId() + "/library/dcat/preview",
                              body,
                              CreateOntologyChangeSet.class))
              .getStatusCode());
    }
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> preview(ontology, "missing-pack", Set.of("dcat")))
            .getStatusCode());
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> preview(ontology, "dcat", Set.of()))
            .getStatusCode());
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> preview(ontology, "dcat", Set.of("missing-module")))
            .getStatusCode());
    final Set<String> excessive =
        IntStream.range(0, 101).mapToObj(index -> "module-" + index).collect(Collectors.toSet());
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> preview(ontology, "dcat", excessive))
            .getStatusCode());
    assertEquals(before, client.ontologies().state(ontology.getId()).getWorkingRevision());
  }

  private static CreateOntologyChangeSet preview(
      Ontology ontology, String packId, Set<String> modules) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/ontologies/" + ontology.getId() + "/library/" + packId + "/preview",
            new PreviewNativeOntologyPack().withModuleIds(modules),
            CreateOntologyChangeSet.class);
  }

  private static NativeOntologyImportSummary summary(OpenMetadataClient client, Ontology ontology) {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/ontologies/" + ontology.getId() + "/library/dcat/summary",
            new PreviewNativeOntologyPack().withModuleIds(Set.of("dcat")),
            NativeOntologyImportSummary.class);
  }
}
