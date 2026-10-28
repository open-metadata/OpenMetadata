package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.apache.jena.vocabulary.SKOS;
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
import org.openmetadata.schema.api.data.OntologyPackList;
import org.openmetadata.schema.api.data.PreviewNativeOntologyPack;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyAxiomType;
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
                              "/v1/ontologies/" + ontology.getId() + "/library/fibo/preview",
                              new PreviewNativeOntologyPack().withModuleIds(Set.of("foundations")),
                              CreateOntologyChangeSet.class))
              .getStatusCode());
    }
  }

  @Test
  void everyBundledPackPreviewsWithoutChangingTheTarget(TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final var packs =
        client
            .getHttpClient()
            .execute(HttpMethod.GET, "/v1/ontologyPacks", null, OntologyPackList.class);
    for (final var pack : packs.getPacks()) {
      if (!Boolean.TRUE.equals(pack.getBundled())) {
        continue;
      }
      final var ontology = createOntology(ns, "library_" + pack.getId());
      final long before = client.ontologies().state(ontology.getId()).getWorkingRevision();
      final Set<String> modules =
          pack.getModules().stream().map(module -> module.getId()).collect(Collectors.toSet());
      final var plan = preview(ontology, pack.getId(), modules);
      assertEquals(
          pack.getModules().stream()
              .mapToInt(module -> module.getConceptCount() + module.getRelationshipCount())
              .sum(),
          plan.getOperations().size());
      assertEquals(before, plan.getBaseWorkingRevision());
      assertEquals(before, client.ontologies().state(ontology.getId()).getWorkingRevision());
    }
  }

  @Test
  void selectedFiboModuleIncludesDependenciesAndAppliesThroughANativeDraft(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var client = SdkClients.adminClient();
    final var plan = preview(ontology, "fibo", Set.of("business-entities"));
    assertEquals(14, plan.getOperations().size());
    assertEquals(
        8,
        plan.getOperations().stream()
            .filter(
                operation ->
                    operation.getOperationType() == OntologyChangeOperationType.UPSERT_CONCEPT)
            .count());
    final var relations =
        plan.getOperations().stream()
            .filter(
                operation ->
                    operation.getOperationType() == OntologyChangeOperationType.UPSERT_AXIOM)
            .toList();
    assertEquals(6, relations.size());
    assertTrue(
        relations.stream()
            .allMatch(
                operation ->
                    operation.getAxiom().getAxiomType()
                            == OntologyAxiomType.OBJECT_PROPERTY_ASSERTION
                        && SKOS.broader
                            .getURI()
                            .equals(operation.getAxiom().getPropertyIri().toString())));
    final var draft =
        ns.trackRoot(
            "ontologyChangeSet",
            client.ontologyChangeSets().create(plan.withName(ns.prefix("libraryDraft"))));
    final var applied =
        OntologyChangeSetTestSupport.applyOntologyChangeSet(client, draft, ns, "libraryEditor");
    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());
    assertEquals(14, applied.getApplicationResult().getOperationsApplied());
    assertEquals(0, preview(ontology, "fibo", Set.of("business-entities")).getOperations().size());
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
                              "/v1/ontologies/" + ontology.getId() + "/library/fibo/preview",
                              body,
                              CreateOntologyChangeSet.class))
              .getStatusCode());
    }
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> preview(ontology, "missing-pack", Set.of("foundations")))
            .getStatusCode());
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> preview(ontology, "fibo", Set.of()))
            .getStatusCode());
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () -> preview(ontology, "fibo", Set.of("missing-module")))
            .getStatusCode());
    final Set<String> excessive =
        IntStream.range(0, 101).mapToObj(index -> "module-" + index).collect(Collectors.toSet());
    assertEquals(
        400,
        assertThrows(OpenMetadataException.class, () -> preview(ontology, "fibo", excessive))
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
}
