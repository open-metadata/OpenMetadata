package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.apache.jena.rdf.model.Model;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.InstallNativeOntologyPack;
import org.openmetadata.schema.api.data.NativeOntologyImportPreview;
import org.openmetadata.schema.api.data.OntologyPackInstallJob;
import org.openmetadata.schema.api.data.OntologyPackInstallJobStatus;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.schema.api.data.PreviewNativeOntologyPack;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.ontology.OntologyPackCatalog;
import org.openmetadata.service.ontology.OntologyPackContentLoader;
import org.openmetadata.service.ontology.OntologyPackModels;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot;
import org.openmetadata.service.rdf.NativeOntologyRdfImporter;

/**
 * Installs every bundled pack through the library install job into a fresh ontology, as the
 * Library UI does. Each pack must complete with the members the importer plans, and installing it
 * again must find nothing to apply. A {@code PACK_INSTALL} JSON line per pack records the sizes and
 * timings, and is appended to {@code -Dontology.packs.report} when set.
 *
 * <p>It runs in the global-state lane, not the parallel one: installing all packs takes 11 to 15
 * minutes during which, being {@code @Isolated}, nothing else in a parallel fork runs, which pushed
 * the parallel lane past its 65 minute budget.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class NativeOntologyEveryPackInstallIT extends BaseOntologyApprovalIT {
  private static final String REPORT_PATH = System.getProperty("ontology.packs.report");
  private static final Duration INSTALL_TIMEOUT = Duration.ofMinutes(20);
  private static final OntologyPackCatalog CATALOG = OntologyPackCatalog.bundled();

  static Stream<String> packIds() {
    final Set<String> only =
        Set.of(System.getProperty("ontology.packs.only", "").split(",")).stream()
            .filter(id -> !id.isBlank())
            .collect(Collectors.toSet());
    return CATALOG.list().stream()
        .map(OntologyPackManifest::getId)
        .filter(id -> only.isEmpty() || only.contains(id));
  }

  @Test
  void theCatalogueHoldsTheUpstreamPacksAndTheStarters() {
    assertEquals(
        Set.of(
            "brick",
            "dcat",
            "dpv",
            "epcis",
            "fhir",
            "fibo",
            "foaf",
            "gs1",
            "hr-open",
            "iof",
            "isa-95",
            "odrl",
            "org",
            "owl-time",
            "prov-o",
            "sosa-ssn"),
        CATALOG.list().stream().map(OntologyPackManifest::getId).collect(Collectors.toSet()));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("packIds")
  void aPackInstallsThroughTheJobAndInstallingAgainChangesNothing(
      final String packId, final TestNamespace ns) {
    final OntologyPackManifest pack = CATALOG.require(packId);
    final Set<String> moduleIds =
        pack.getModules().stream().map(module -> module.getId()).collect(Collectors.toSet());
    final Ontology ontology = createLibraryOntology(ns, packId);
    final Map<String, Object> report = new LinkedHashMap<>();
    report.put("pack", packId);
    report.put("db", System.getProperty("databaseType", "unknown"));

    final int planned = plannedMembers(ontology, packId, moduleIds, report);
    previewAndSample(ontology, packId, moduleIds, report);

    final long started = System.nanoTime();
    final OntologyPackInstallJob first = start(ontology, packId, moduleIds);
    final OntologyPackInstallJob done = awaitTerminal(ontology, first.getId());
    report.put("installMs", Duration.ofNanos(System.nanoTime() - started).toMillis());
    assertEquals(OntologyPackInstallJobStatus.COMPLETED, done.getStatus(), done.getError());
    assertEquals(planned, done.getMemberCount(), packId + " members");
    assertEquals(planned, done.getMembersApplied(), packId + " applied");
    assertEquals(done.getTotal(), done.getProgress(), packId + " slices");
    report.put("members", done.getMemberCount());
    report.put("slices", done.getTotal());

    final int stored = storedMembers(ontology);
    assertEquals(planned, stored, packId + " stored members");
    assertEquals(
        1,
        SdkClients.adminClient().ontologies().get(ontology.getId()).getInstalledPacks().size(),
        packId + " installed record");

    final OntologyPackInstallJob again =
        awaitTerminal(ontology, start(ontology, packId, moduleIds).getId());
    assertEquals(OntologyPackInstallJobStatus.COMPLETED, again.getStatus(), again.getError());
    assertEquals(0, again.getTotal(), packId + " slices on a repeat");
    assertEquals(0, again.getMemberCount(), packId + " members on a repeat");
    assertEquals(planned, storedMembers(ontology), packId + " members after a repeat");
    publish(report);
  }

  private static int plannedMembers(
      final Ontology ontology,
      final String packId,
      final Set<String> moduleIds,
      final Map<String, Object> report) {
    final var selected =
        new OntologyPackContentLoader(NativeOntologyEveryPackInstallIT.class.getClassLoader())
            .select(CATALOG, packId, moduleIds);
    final Model model =
        new OntologyPackModels(
                new OntologyPackContentLoader(
                    NativeOntologyEveryPackInstallIT.class.getClassLoader()))
            .load(selected.modules());
    try {
      final List<OntologyChangeOperation> operations =
          OntologyWorkingSnapshot.production()
              .read(
                  ontology.getId(),
                  ignored -> {},
                  working -> new NativeOntologyRdfImporter().reconcileUnbounded(model, working))
              .getOperations();
      report.put(
          "plannedConcepts", countOf(operations, OntologyChangeOperationType.UPSERT_CONCEPT));
      report.put(
          "plannedProperties", countOf(operations, OntologyChangeOperationType.UPSERT_PROPERTY));
      report.put("plannedAxioms", countOf(operations, OntologyChangeOperationType.UPSERT_AXIOM));
      return operations.size();
    } finally {
      model.close();
    }
  }

  private static void previewAndSample(
      final Ontology ontology,
      final String packId,
      final Set<String> moduleIds,
      final Map<String, Object> report) {
    final long previewStarted = System.nanoTime();
    final String body =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.POST,
                "/v1/ontologies/" + ontology.getId() + "/library/" + packId + "/review",
                new PreviewNativeOntologyPack().withModuleIds(moduleIds));
    report.put("previewMs", Duration.ofNanos(System.nanoTime() - previewStarted).toMillis());
    report.put("previewBytes", body.getBytes(StandardCharsets.UTF_8).length);
    final NativeOntologyImportPreview preview =
        JsonUtils.readValue(body, NativeOntologyImportPreview.class);
    report.put("skipped", preview.getSummary().getSkippedStatements().getTotal());
    assertFalse(preview.getSummary().getItems().isEmpty(), packId + " review items");

    final long sampleStarted = System.nanoTime();
    final JsonNode sample =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/ontologyPacks/" + packId + "/sample?moduleIds=" + String.join(",", moduleIds),
                null,
                JsonNode.class);
    report.put("sampleMs", Duration.ofNanos(System.nanoTime() - sampleStarted).toMillis());
    assertTrue(sample.path("conceptCount").asInt() > 0, packId + " sample concepts");
  }

  private static Ontology createLibraryOntology(final TestNamespace ns, final String packId) {
    return ns.trackRoot(
        "ontology",
        SdkClients.adminClient()
            .ontologies()
            .create(request(ns).withName(ns.prefix(packId)).withReviewers(null)));
  }

  private static int storedMembers(final Ontology ontology) {
    return count("/v1/ontologyConcepts?ontology=" + ontology.getFullyQualifiedName())
        + count("/v1/ontologyProperties?ontology=" + ontology.getFullyQualifiedName())
        + count("/v1/ontologyAxioms?ontologyId=" + ontology.getId());
  }

  private static int countOf(
      final List<OntologyChangeOperation> operations, final OntologyChangeOperationType type) {
    return (int)
        operations.stream().filter(operation -> operation.getOperationType() == type).count();
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
        .atMost(INSTALL_TIMEOUT)
        .pollInterval(Duration.ofSeconds(1))
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
    return JsonUtils.readTree(body).path("paging").path("total").asInt();
  }

  private static void publish(final Map<String, Object> report) {
    final String line = "PACK_INSTALL " + JsonUtils.pojoToJson(report);
    System.out.println(line);
    if (REPORT_PATH != null) {
      try {
        Files.writeString(
            Path.of(REPORT_PATH),
            line + System.lineSeparator(),
            StandardOpenOption.CREATE,
            StandardOpenOption.APPEND);
      } catch (IOException exception) {
        throw new UncheckedIOException(exception);
      }
    }
  }
}
