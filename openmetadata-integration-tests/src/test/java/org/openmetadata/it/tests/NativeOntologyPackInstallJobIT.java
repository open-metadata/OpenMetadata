package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.apache.jena.rdf.model.Model;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.InstallNativeOntologyPack;
import org.openmetadata.schema.api.data.OntologyPackInstallJob;
import org.openmetadata.schema.api.data.OntologyPackInstallJobArguments;
import org.openmetadata.schema.api.data.OntologyPackInstallJobStatus;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.type.OntologyPackModuleInstallation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jobs.BackgroundJobException;
import org.openmetadata.service.ontology.OntologyPackCatalog;
import org.openmetadata.service.ontology.OntologyPackContentLoader;
import org.openmetadata.service.ontology.OntologyPackInstallJobHandler;
import org.openmetadata.service.ontology.OntologyPackInstallJobManager;
import org.openmetadata.service.ontology.OntologyPackInstallations;
import org.openmetadata.service.ontology.OntologyPackModels;
import org.openmetadata.service.rdf.RdfSerializationFormat;
import org.openmetadata.service.rdf.SafeRdfModelParser;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class NativeOntologyPackInstallJobIT extends BaseOntologyApprovalIT {
  private static final int SYNTHETIC_MEMBERS =
      Integer.getInteger("ontology.packInstall.syntheticMembers", 2600);

  @Test
  void theWorkerInstallsABundledPackAndInstallingAgainChangesNothing(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);

    final OntologyPackInstallJob first = start(ontology, "fhir", Set.of("workflow"));
    assertEquals(OntologyPackInstallJobStatus.QUEUED, first.getStatus());
    final OntologyPackInstallJob done = awaitTerminal(ontology, first.getId());

    assertEquals(OntologyPackInstallJobStatus.COMPLETED, done.getStatus());
    assertEquals(done.getTotal(), done.getProgress());
    assertEquals(14, done.getMemberCount());
    assertEquals(14, done.getMembersApplied());
    assertEquals(8, count("/v1/ontologyConcepts?ontology=" + ontology.getFullyQualifiedName()));
    assertEquals(6, count("/v1/ontologyAxioms?ontologyId=" + ontology.getId()));
    final var installed =
        SdkClients.adminClient().ontologies().get(ontology.getId()).getInstalledPacks();
    assertEquals(1, installed.size());
    assertEquals("fhir", installed.getFirst().getPackId());
    assertEquals(List.of("core", "workflow"), moduleIds(installed.getFirst().getModules()));

    final OntologyPackInstallJob again =
        awaitTerminal(ontology, start(ontology, "fhir", Set.of("workflow")).getId());
    assertEquals(OntologyPackInstallJobStatus.COMPLETED, again.getStatus());
    assertEquals(0, again.getTotal());
    assertEquals(0, again.getMemberCount());
    assertEquals(8, count("/v1/ontologyConcepts?ontology=" + ontology.getFullyQualifiedName()));
    assertEquals(
        installed.getFirst().getInstalledAt(),
        SdkClients.adminClient()
            .ontologies()
            .get(ontology.getId())
            .getInstalledPacks()
            .getFirst()
            .getInstalledAt());
  }

  @Test
  void aJobIsReadableOnlyThroughItsOwnOntology(TestNamespace ns) {
    final Ontology ontology = createOntology(ns, "jobOwner");
    final Ontology other = createOntology(ns, "jobStranger");
    final OntologyPackInstallJob job = start(ontology, "gs1", Set.of("core-vocabulary"));

    assertThrows(OpenMetadataException.class, () -> get(other, job.getId()));
    assertEquals(job.getId(), get(ontology, job.getId()).getId());
    awaitTerminal(ontology, job.getId());
  }

  @Test
  void startingTheSameInstallWhileOneIsActiveJoinsItAndADifferentOneIsRefused(TestNamespace ns) {
    final Ontology ontology = createOntology(ns, "joinOwner");
    final long held = queuedJob(ontology, "fhir", Set.of("workflow"));

    assertEquals(held, start(ontology, "fhir", Set.of("workflow")).getId());
    assertThrows(
        OpenMetadataException.class, () -> start(ontology, "gs1", Set.of("core-vocabulary")));
  }

  @Test
  void installingAgainResumesFromWhatALostJobAlreadyApplied(TestNamespace ns) {
    final Ontology ontology = createOntology(ns, "resumed");
    final AtomicInteger applied = new AtomicInteger();
    final var failingHandler =
        OntologyPackInstallJobHandler.create(
            realModels(),
            5,
            real ->
                request -> {
                  if (applied.get() == 2) {
                    throw new IllegalStateException("simulated failure before slice 3");
                  }
                  real.apply(request);
                  applied.incrementAndGet();
                });

    final long lost = queuedJob(ontology, "fhir", Set.of("workflow"));
    assertThrows(BackgroundJobException.class, () -> failingHandler.runJob(job(lost)));

    assertEquals(
        BackgroundJob.Status.FAILED,
        Entity.getJobDAO().fetchJobById(lost).orElseThrow().getStatus());
    assertEquals(2, applied.get());
    assertEquals(8, count("/v1/ontologyConcepts?ontology=" + ontology.getFullyQualifiedName()));
    assertEquals(2, count("/v1/ontologyAxioms?ontologyId=" + ontology.getId()));
    assertEquals(
        0, SdkClients.adminClient().ontologies().get(ontology.getId()).getInstalledPacks().size());

    final long resumed = queuedJob(ontology, "fhir", Set.of("workflow"));
    OntologyPackInstallJobHandler.create(realModels(), 5, real -> real).runJob(job(resumed));

    final OntologyPackInstallJob job = manager().get(resumed);
    assertEquals(OntologyPackInstallJobStatus.COMPLETED, job.getStatus());
    assertEquals(4, job.getMemberCount());
    assertEquals(8, count("/v1/ontologyConcepts?ontology=" + ontology.getFullyQualifiedName()));
    assertEquals(6, count("/v1/ontologyAxioms?ontologyId=" + ontology.getId()));
    assertEquals(
        1, SdkClients.adminClient().ontologies().get(ontology.getId()).getInstalledPacks().size());

    final long rerun = queuedJob(ontology, "fhir", Set.of("workflow"));
    OntologyPackInstallJobHandler.create(realModels(), 5, real -> real).runJob(job(rerun));
    assertEquals(0, manager().get(rerun).getMemberCount());
  }

  @Test
  void cutsALargePackIntoSlicesThatAllApplyWithFlatCost(TestNamespace ns) {
    final Ontology ontology = createOntology(ns, "synthetic");
    final SyntheticPack pack = new SyntheticPack(SYNTHETIC_MEMBERS);
    final List<Long> sliceMillis = new ArrayList<>();
    final var handler =
        OntologyPackInstallJobHandler.create(
            modules -> pack.model(),
            1000,
            real ->
                request -> {
                  final long started = System.nanoTime();
                  real.apply(request);
                  sliceMillis.add(Duration.ofNanos(System.nanoTime() - started).toMillis());
                });

    final long id = queuedJob(ontology, "fhir", Set.of("core"));
    handler.runJob(job(id));

    final OntologyPackInstallJob job = manager().get(id);
    assertEquals(OntologyPackInstallJobStatus.COMPLETED, job.getStatus());
    assertEquals(pack.members(), job.getMemberCount());
    assertEquals(pack.members() / 1000 + 1, job.getTotal());
    assertEquals(job.getTotal(), sliceMillis.size());
    assertEquals(
        pack.concepts, count("/v1/ontologyConcepts?ontology=" + ontology.getFullyQualifiedName()));
    assertEquals(
        pack.properties,
        count("/v1/ontologyProperties?ontology=" + ontology.getFullyQualifiedName()));
    assertEquals(pack.axioms, count("/v1/ontologyAxioms?ontologyId=" + ontology.getId()));
    System.out.println("SLICE_TIMING_MS members=" + pack.members() + " " + sliceMillis);
  }

  private static OntologyPackInstallJobHandler.ModelSource realModels() {
    return new OntologyPackModels(
        new OntologyPackContentLoader(OntologyPackCatalog.class.getClassLoader()));
  }

  private static OntologyPackInstallJobManager manager() {
    return new OntologyPackInstallJobManager(Entity.getJobDAO(), Clock.systemUTC());
  }

  /** Queued an hour ahead so the server's own worker leaves it for the test to run. */
  private static long queuedJob(
      final Ontology ontology, final String packId, final Set<String> moduleIds) {
    final OntologyPackCatalog catalog = OntologyPackCatalog.bundled();
    final var manifest = catalog.require(packId);
    final var modules = catalog.select(manifest, moduleIds);
    final var source = OntologyPackInstallations.sourcePack(manifest, modules);
    final var arguments =
        new OntologyPackInstallJobArguments()
            .withOntologyId(ontology.getId())
            .withPackId(source.getPackId())
            .withVersion(source.getVersion())
            .withModuleIds(source.getModuleIds())
            .withPackDigest(OntologyPackInstallations.packDigest(source, modules));
    return Entity.getJobDAO()
        .insertTrackedJobInternal(
            BackgroundJob.JobType.ONTOLOGY_PACK_INSTALL.name(),
            OntologyPackInstallJobManager.HANDLER_NAME,
            JsonUtils.pojoToJson(arguments),
            "admin",
            System.currentTimeMillis() + Duration.ofHours(1).toMillis(),
            0,
            0,
            "queued by test");
  }

  private static BackgroundJob job(final long id) {
    return Entity.getJobDAO().fetchJobById(id).orElseThrow();
  }

  private static OntologyPackInstallJob start(
      final Ontology ontology, final String packId, final Set<String> moduleIds) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.POST,
            "/v1/ontologies/" + ontology.getId() + "/library/" + packId + "/install",
            new InstallNativeOntologyPack().withModuleIds(moduleIds),
            OntologyPackInstallJob.class);
  }

  private static OntologyPackInstallJob get(final Ontology ontology, final long jobId) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/ontologies/" + ontology.getId() + "/library/jobs/" + jobId,
            null,
            OntologyPackInstallJob.class);
  }

  private static OntologyPackInstallJob awaitTerminal(final Ontology ontology, final long jobId) {
    Awaitility.await()
        .atMost(Duration.ofSeconds(90))
        .pollInterval(Duration.ofMillis(500))
        .until(() -> isTerminal(get(ontology, jobId)));
    return get(ontology, jobId);
  }

  private static boolean isTerminal(final OntologyPackInstallJob job) {
    return Set.of(
            OntologyPackInstallJobStatus.COMPLETED,
            OntologyPackInstallJobStatus.FAILED,
            OntologyPackInstallJobStatus.CANCELLED)
        .contains(job.getStatus());
  }

  private static int count(final String path) {
    final String body =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, path + "&limit=1", null);
    final JsonNode total = JsonUtils.readTree(body).path("paging").path("total");
    assertNotNull(total);
    return total.asInt();
  }

  private static List<String> moduleIds(final List<OntologyPackModuleInstallation> modules) {
    return modules.stream().map(module -> module.getModuleId()).toList();
  }

  /** Concepts in a tree, object properties between them and a subclass axiom per non-root concept. */
  private static final class SyntheticPack {
    private static final String PREFIXES =
        """
        @prefix ex: <https://example.org/synthetic/> .
        @prefix owl: <http://www.w3.org/2002/07/owl#> .
        @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
        """;
    private final int properties;
    private final int concepts;
    private final int axioms;

    SyntheticPack(final int members) {
      properties = members / 10;
      concepts = (members - properties + 1) / 2;
      axioms = concepts - 1;
    }

    int members() {
      return concepts + properties + axioms;
    }

    Model model() {
      final String body =
          PREFIXES
              + IntStream.range(0, concepts)
                  .mapToObj(i -> "ex:C%d a owl:Class ; rdfs:label \"Concept %d\" .".formatted(i, i))
                  .collect(Collectors.joining("\n"))
              + "\n"
              + IntStream.range(0, properties)
                  .mapToObj(
                      i ->
                          "ex:p%d a owl:ObjectProperty ; rdfs:domain ex:C%d ; rdfs:range ex:C%d ."
                              .formatted(i, i % concepts, (i + 1) % concepts))
                  .collect(Collectors.joining("\n"))
              + "\n"
              + IntStream.range(1, concepts)
                  .mapToObj(i -> "ex:C%d rdfs:subClassOf ex:C%d .".formatted(i, i / 10))
                  .collect(Collectors.joining("\n"));
      return new SafeRdfModelParser().parse(body, RdfSerializationFormat.TURTLE);
    }
  }
}
