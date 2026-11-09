package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFFormat;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.InstallNativeOntologyPack;
import org.openmetadata.schema.api.data.OntologyPackInstallJob;
import org.openmetadata.schema.api.data.OntologyPackInstallJobStatus;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.ontology.OntologyPackCatalog;
import org.openmetadata.service.ontology.OntologyReleaseReader;
import org.openmetadata.service.rdf.OntologyActiveGraph;
import org.openmetadata.service.rdf.OntologyReleaseProjection;

/**
 * The two largest bundled packs, installed through the job, captured as a release and activated
 * into the serving dataset. A {@code PACK_ACTIVATION} JSON line records the member count, capture
 * and activation times and the size of the projection written to the triple store.
 */
@Tag("rdf")
@EnabledIfSystemProperty(named = "enableRdf", matches = "true")
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class RdfLibraryPackActivationIT extends BaseOntologyApprovalIT {
  private static final int ONTOLOGY_ROOT_MEMBERS = 1;

  private static final String REPORT_PATH = System.getProperty("ontology.packs.report");
  private static final Duration INSTALL_TIMEOUT = Duration.ofMinutes(20);

  @AfterEach
  void restoreRdf() {
    RdfTestUtils.restoreSuiteRdf();
  }

  @ParameterizedTest(name = "{0}")
  @ValueSource(strings = {"fibo", "fhir"})
  void aLargePackCapturesAsAReleaseAndActivates(final String packId, final TestNamespace ns) {
    final var client = SdkClients.adminClient();
    final Set<String> moduleIds =
        OntologyPackCatalog.bundled().require(packId).getModules().stream()
            .map(module -> module.getId())
            .collect(Collectors.toSet());
    final Ontology ontology =
        ns.trackRoot(
            "ontology",
            client
                .ontologies()
                .create(request(ns).withName(ns.prefix(packId)).withReviewers(null)));
    final Map<String, Object> report = new LinkedHashMap<>();
    report.put("pack", packId);
    report.put("db", System.getProperty("databaseType", "unknown"));

    final long installStarted = System.nanoTime();
    final OntologyPackInstallJob job = install(ontology, packId, moduleIds);
    report.put("installMs", millisSince(installStarted));
    assertEquals(OntologyPackInstallJobStatus.COMPLETED, job.getStatus(), job.getError());
    report.put("members", job.getMemberCount());
    report.put("slices", job.getTotal());

    final long captureStarted = System.nanoTime();
    final OntologyRelease release =
        client
            .ontologies()
            .capture(
                ontology.getId(),
                new CaptureOntologyRelease()
                    .withExpectedWorkingRevision(
                        client.ontologies().state(ontology.getId()).getWorkingRevision()));
    report.put("captureMs", millisSince(captureStarted));
    report.put("releaseMembers", release.getMemberCount());
    report.put("releaseBytes", release.getTotalBytes());
    assertEquals(job.getMemberCount() + ONTOLOGY_ROOT_MEMBERS, release.getMemberCount());

    projection(release.getId(), report);

    final long activationStarted = System.nanoTime();
    final var state =
        client
            .ontologies()
            .activate(
                ontology.getId(),
                new ActivateOntologyRelease()
                    .withReleaseId(release.getId())
                    .withExpectedActivationRevision(0L));
    report.put("activationMs", millisSince(activationStarted));
    assertEquals(release.getId(), state.getActiveReleaseId());

    final long served = servedTriples(ontology);
    report.put("sparqlTriples", served);
    assertTrue(served > 0, packId + " serves triples after activation");
    publish(report);
  }

  private static OntologyPackInstallJob install(
      final Ontology ontology, final String packId, final Set<String> moduleIds) {
    final var http = SdkClients.adminClient().getHttpClient();
    final OntologyPackInstallJob started =
        http.execute(
            HttpMethod.POST,
            "/v1/ontologies/" + ontology.getId() + "/library/" + packId + "/install",
            new InstallNativeOntologyPack().withModuleIds(moduleIds),
            OntologyPackInstallJob.class);
    final String path = "/v1/ontologies/" + ontology.getId() + "/library/jobs/" + started.getId();
    Awaitility.await()
        .atMost(INSTALL_TIMEOUT)
        .pollInterval(Duration.ofSeconds(1))
        .until(
            () ->
                Set.of(
                        OntologyPackInstallJobStatus.COMPLETED,
                        OntologyPackInstallJobStatus.FAILED,
                        OntologyPackInstallJobStatus.CANCELLED)
                    .contains(
                        http.execute(HttpMethod.GET, path, null, OntologyPackInstallJob.class)
                            .getStatus()));
    return http.execute(HttpMethod.GET, path, null, OntologyPackInstallJob.class);
  }

  private static long servedTriples(final Ontology ontology) {
    final JsonNode result =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.POST,
                "/v1/ontologies/" + ontology.getId() + "/sparql",
                new SparqlQuery().withQuery("SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }"),
                JsonNode.class);
    return result.path("results").path("bindings").get(0).path("n").path("value").asLong();
  }

  private static void projection(final UUID releaseId, final Map<String, Object> report) {
    final CollectionDAO dao = Entity.getCollectionDAO();
    final OntologyRelease release = dao.ontologyReleaseDAO().findEntityById(releaseId);
    final var members = new OntologyReleaseReader(dao).read(release, ignored -> {});
    final long buildStarted = System.nanoTime();
    final Model model =
        new OntologyReleaseProjection(OntologyReleaseProjection.StatementSources.OMITTED)
            .build(release, members);
    report.put("projectionBuildMs", millisSince(buildStarted));
    try {
      final ByteArrayOutputStream thrift = new ByteArrayOutputStream();
      RDFDataMgr.write(thrift, model, RDFFormat.RDF_THRIFT);
      report.put("projectionTriples", model.size());
      report.put("projectionThriftBytes", thrift.size());
      assertTrue(
          thrift.size() <= OntologyActiveGraph.MAX_GRAPH_BYTES,
          "the projection fits the active graph limit");
    } finally {
      model.close();
    }
  }

  private static long millisSince(final long startedNanos) {
    return Duration.ofNanos(System.nanoTime() - startedNanos).toMillis();
  }

  private static void publish(final Map<String, Object> report) {
    final String line = "PACK_ACTIVATION " + JsonUtils.pojoToJson(report);
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
