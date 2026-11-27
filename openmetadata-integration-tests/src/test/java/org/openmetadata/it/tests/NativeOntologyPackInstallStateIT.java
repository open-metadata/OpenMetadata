package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
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
import org.openmetadata.schema.api.data.OntologyPackList;
import org.openmetadata.schema.api.data.PreviewNativeOntologyPack;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.schema.type.OntologyPackModuleInstallation;
import org.openmetadata.schema.type.OntologyPackSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.config.OpenMetadataConfig;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

// Installing upstream packs writes thousands of definitions and relationships; concurrent
// installs deadlock on MySQL gap locks.
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class NativeOntologyPackInstallStateIT extends BaseOntologyApprovalIT {
  @Test
  void applyingAPackRecordsItsVerifiedProvenanceAndCatalogueLocation(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final var applied = install(ns, ontology, "sosa-ssn", Set.of("ssn"));
    assertEquals(OntologyChangeSetState.APPLIED, applied.getState());

    final Ontology stored = SdkClients.adminClient().ontologies().get(ontology.getId());
    assertEquals(1, stored.getInstalledPacks().size());
    final var installation = stored.getInstalledPacks().getFirst();
    final var sensors =
        packs().getPacks().stream()
            .filter(pack -> pack.getId().equals("sosa-ssn"))
            .findFirst()
            .orElseThrow();
    assertEquals("sosa-ssn", installation.getPackId());
    assertEquals(sensors.getVersion(), installation.getVersion());
    assertEquals(
        List.of("sosa", "ssn"),
        installation.getModules().stream()
            .map(OntologyPackModuleInstallation::getModuleId)
            .toList());
    assertEquals(
        sensors.getModules().getFirst().getSha256(),
        installation.getModules().getFirst().getSha256());
    assertNotNull(installation.getInstalledAt());
    assertNotNull(installation.getInstalledBy());
    assertEquals(sensors.getLicense(), installation.getLicense());
    assertTrue(stored.getVersion() > ontology.getVersion());
    assertTrue(
        packs().getInstallations().stream()
            .anyMatch(
                record ->
                    record.getOntology().getId().equals(ontology.getId())
                        && record.getInstallation().getPackId().equals("sosa-ssn")));
  }

  @Test
  void catalogueListsIndustriesAndMergesRepeatedInstallation(TestNamespace ns) {
    final var catalogue = packs();
    assertTrue(
        catalogue.getPacks().stream()
            .allMatch(pack -> pack.getIndustry() != null && pack.getLayer() != null));
    assertEquals(
        "finance",
        catalogue.getPacks().stream()
            .filter(pack -> pack.getId().equals("fibo"))
            .findFirst()
            .orElseThrow()
            .getIndustry()
            .value());
    assertEquals(
        "healthcare",
        catalogue.getPacks().stream()
            .filter(pack -> pack.getId().equals("fhir"))
            .findFirst()
            .orElseThrow()
            .getIndustry()
            .value());

    assertEquals("cross-industry", industryOf(catalogue, "dcat"));
    assertEquals("buildings-and-energy", industryOf(catalogue, "brick"));
    final Ontology first = createOntology(ns, "libraryFirst");
    final Ontology second = createOntology(ns, "librarySecond");
    install(ns, first, "sosa-ssn", Set.of("sosa"));
    install(ns, first, "sosa-ssn", Set.of("ssn"));
    install(ns, second, "sosa-ssn", Set.of("sosa"));

    final var stored = SdkClients.adminClient().ontologies().get(first.getId());
    assertEquals(1, stored.getInstalledPacks().size());
    assertEquals(
        List.of("sosa", "ssn"),
        stored.getInstalledPacks().getFirst().getModules().stream()
            .map(OntologyPackModuleInstallation::getModuleId)
            .toList());
    final var installs =
        packs().getInstallations().stream()
            .filter(record -> record.getInstallation().getPackId().equals("sosa-ssn"))
            .filter(
                record ->
                    Set.of(first.getId(), second.getId()).contains(record.getOntology().getId()))
            .toList();
    assertEquals(2, installs.size());
  }

  @Test
  void installedPacksSurvivePutAndRejectClientPatch(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    install(ns, ontology, "prov-o", Set.of("prov-o"));
    final var client = SdkClients.adminClient();
    final Ontology stored = client.ontologies().get(ontology.getId());
    final Ontology put =
        client
            .ontologies()
            .upsert(
                request(ns)
                    .withName(stored.getName())
                    .withDescription("Updated after installation"));
    assertEquals(ontology.getId(), put.getId());
    assertEquals("Updated after installation", put.getDescription());
    assertEquals(
        stored.getInstalledPacks(), client.ontologies().get(ontology.getId()).getInstalledPacks());

    final var patch = JsonUtils.getObjectMapper().createArrayNode();
    patch.addObject().put("op", "remove").put("path", "/installedPacks");
    assertEquals(
        400,
        assertThrows(
                OpenMetadataException.class,
                () ->
                    client
                        .getHttpClient()
                        .execute(
                            HttpMethod.PATCH,
                            "/v1/ontologies/" + ontology.getId(),
                            patch,
                            Ontology.class))
            .getStatusCode());
    assertEquals(
        stored.getInstalledPacks(), client.ontologies().get(ontology.getId()).getInstalledPacks());
  }

  @Test
  void sourcePackMustMatchTheVerifiedCatalogAndCannotChange(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final var client = SdkClients.adminClient();
    final CreateOntologyChangeSet plan = preview(ontology, "dcat", Set.of("dcat"));
    for (final OntologyPackSource source :
        List.of(
            new OntologyPackSource()
                .withPackId("missing")
                .withVersion(plan.getSourcePack().getVersion())
                .withModuleIds(Set.of("dcat")),
            new OntologyPackSource()
                .withPackId("dcat")
                .withVersion("0.0.0")
                .withModuleIds(Set.of("dcat")),
            new OntologyPackSource()
                .withPackId("dcat")
                .withVersion(plan.getSourcePack().getVersion())
                .withModuleIds(Set.of("missing")))) {
      final CreateOntologyChangeSet invalid =
          JsonUtils.deepCopy(plan, CreateOntologyChangeSet.class)
              .withName(ns.prefix("invalid" + UUID.randomUUID()))
              .withSourcePack(source);
      assertEquals(
          400,
          assertThrows(
                  OpenMetadataException.class, () -> client.ontologyChangeSets().create(invalid))
              .getStatusCode());
    }
    final OntologyChangeSet draft =
        ns.trackRoot(
            "ontologyChangeSet",
            client.ontologyChangeSets().create(plan.withName(ns.prefix("immutable"))));
    final var patch = JsonUtils.getObjectMapper().createArrayNode();
    patch.addObject().put("op", "replace").put("path", "/sourcePack/version").put("value", "0.0.0");
    assertEquals(
        405,
        assertThrows(
                OpenMetadataException.class,
                () ->
                    client
                        .getHttpClient()
                        .execute(
                            HttpMethod.PATCH,
                            "/v1/ontologyChangeSets/" + draft.getId(),
                            patch,
                            OntologyChangeSet.class))
            .getStatusCode());
    assertEquals(
        plan.getSourcePack(), client.ontologyChangeSets().get(draft.getId()).getSourcePack());
  }

  @Test
  void alteredPackPlanIsRejectedBeforeDefinitionsAndInstallation(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final var client = SdkClients.adminClient();
    final long revision = client.ontologies().state(ontology.getId()).getWorkingRevision();
    final CreateOntologyChangeSet plan = preview(ontology, "dcat", Set.of("dcat"));
    final OntologyChangeOperation firstConcept =
        plan.getOperations().stream()
            .filter(
                operation ->
                    operation.getOperationType() == OntologyChangeOperationType.UPSERT_CONCEPT)
            .findFirst()
            .orElseThrow();
    final var operations = new ArrayList<>(plan.getOperations());
    final OntologyChangeOperation conflicting =
        JsonUtils.deepCopy(firstConcept, OntologyChangeOperation.class).withId(UUID.randomUUID());
    conflicting.getConcept().setId(UUID.randomUUID());
    conflicting.getConcept().setIri(URI.create("urn:pr15:" + UUID.randomUUID()));
    operations.add(conflicting);
    plan.setOperations(operations);
    plan.setUndoCursor(operations.size());
    final OntologyChangeSet draft =
        ns.trackRoot(
            "ontologyChangeSet",
            client.ontologyChangeSets().create(plan.withName(ns.prefix("rollback"))));
    assertEquals(
        412,
        assertThrows(
                OpenMetadataException.class,
                () ->
                    OntologyChangeSetTestSupport.applyOntologyChangeSet(
                        client, draft, ns, "libraryEditor"))
            .getStatusCode());
    assertEquals(
        OntologyChangeSetState.DRAFT, client.ontologyChangeSets().get(draft.getId()).getState());
    assertEquals(revision, client.ontologies().state(ontology.getId()).getWorkingRevision());
    assertTrue(
        client.ontologies().get(ontology.getId()).getInstalledPacks() == null
            || client.ontologies().get(ontology.getId()).getInstalledPacks().isEmpty());
    assertTrue(
        packs().getInstallations().stream()
            .noneMatch(record -> record.getOntology().getId().equals(ontology.getId())));
  }

  @Test
  void catalogueHidesDeletedAndUnauthorizedInstallations(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    install(ns, ontology, "foaf", Set.of("foaf"));
    final var client = SdkClients.adminClient();
    assertTrue(installedIn(packs(), ontology.getId()));

    try (RdfAccessFixtures fixtures = new RdfAccessFixtures("pack" + ns.shortPrefix())) {
      final var role = fixtures.denyRole(MetadataOperation.VIEW_BASIC, Entity.ONTOLOGY);
      final var reader =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(fixtures.userToken("reader", List.of(role.getId())))
                  .build());
      final OntologyPackList visible =
          reader
              .getHttpClient()
              .execute(HttpMethod.GET, "/v1/ontologyPacks", null, OntologyPackList.class);
      assertTrue(!installedIn(visible, ontology.getId()));
    }

    client.ontologies().delete(ontology.getId().toString(), Map.of("recursive", "true"));
    assertTrue(!installedIn(packs(), ontology.getId()));
    client.ontologies().restore(ontology.getId());
    assertTrue(installedIn(packs(), ontology.getId()));
  }

  @Test
  void catalogueAppliesOwnerConditionsToInstallations(TestNamespace ns) {
    final var admin = SdkClients.adminClient();
    final Ontology owned =
        ns.trackRoot(
            Entity.ONTOLOGY,
            admin
                .ontologies()
                .create(
                    request(ns)
                        .withName(ns.prefix("ownedLibrary"))
                        .withOwners(
                            List.of(admin.users().getByName("admin").getEntityReference()))));
    final Ontology unowned = createOntology(ns, "unownedLibrary");
    install(ns, owned, "prov-o", Set.of("prov-o"));
    install(ns, unowned, "prov-o", Set.of("prov-o"));
    assertTrue(installedIn(packs(), owned.getId()));
    assertTrue(installedIn(packs(), unowned.getId()));

    try (RdfAccessFixtures fixtures = new RdfAccessFixtures("pack" + ns.shortPrefix())) {
      final var role =
          fixtures.denyRole(MetadataOperation.VIEW_BASIC, Entity.ONTOLOGY, "!noOwner()");
      final var allow = fixtures.allowRole(MetadataOperation.VIEW_BASIC, Entity.ONTOLOGY);
      final var reader =
          new OpenMetadataClient(
              OpenMetadataConfig.builder()
                  .serverUrl(SdkClients.baseUrl())
                  .accessToken(fixtures.userToken("reader", List.of(allow.getId(), role.getId())))
                  .build());
      final OntologyPackList visible =
          reader
              .getHttpClient()
              .execute(HttpMethod.GET, "/v1/ontologyPacks", null, OntologyPackList.class);
      assertFalse(installedIn(visible, owned.getId()));
      assertTrue(installedIn(visible, unowned.getId()));
    }
  }

  private static org.openmetadata.schema.entity.data.OntologyChangeSet install(
      final TestNamespace ns,
      final Ontology ontology,
      final String packId,
      final Set<String> moduleIds) {
    final var client = SdkClients.adminClient();
    final CreateOntologyChangeSet plan = preview(ontology, packId, moduleIds);
    final var draft =
        ns.trackRoot(
            "ontologyChangeSet",
            client
                .ontologyChangeSets()
                .create(plan.withName(ns.prefix("install" + UUID.randomUUID()))));
    return OntologyChangeSetTestSupport.applyOntologyChangeSet(client, draft, ns, "libraryEditor");
  }

  private static CreateOntologyChangeSet preview(
      final Ontology ontology, final String packId, final Set<String> moduleIds) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/ontologies/" + ontology.getId() + "/library/" + packId + "/preview",
            new PreviewNativeOntologyPack().withModuleIds(moduleIds),
            CreateOntologyChangeSet.class);
  }

  private static OntologyPackList packs() {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.GET, "/v1/ontologyPacks", null, OntologyPackList.class);
  }

  private static boolean installedIn(final OntologyPackList catalogue, final UUID ontologyId) {
    return catalogue.getInstallations().stream()
        .anyMatch(record -> record.getOntology().getId().equals(ontologyId));
  }

  private static String industryOf(final OntologyPackList catalogue, final String packId) {
    return catalogue.getPacks().stream()
        .filter(pack -> pack.getId().equals(packId))
        .findFirst()
        .orElseThrow()
        .getIndustry()
        .value();
  }
}
