package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.apache.commons.codec.digest.DigestUtils;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFFormat;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.NativeOntologyImportFormat;
import org.openmetadata.schema.api.data.NativeOntologyImportPreview;
import org.openmetadata.schema.api.data.OntologyPackInstallJob;
import org.openmetadata.schema.api.data.OntologyPackInstallJobArguments;
import org.openmetadata.schema.api.data.OntologyPackInstallJobStatus;
import org.openmetadata.schema.api.data.PreviewNativeOntologyImport;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.ontology.OntologyPackCatalog;
import org.openmetadata.service.ontology.OntologyPackInstallJobHandler;
import org.openmetadata.service.ontology.OntologyPackInstallJobManager;
import org.openmetadata.service.ontology.OntologyPackInstallations;
import org.openmetadata.service.ontology.OntologyReleaseReader;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot;
import org.openmetadata.service.rdf.NativeOntologyRdfImporter;
import org.openmetadata.service.rdf.OntologyReleaseProjection;
import org.openmetadata.service.rdf.RdfSerializationFormat;
import org.openmetadata.service.rdf.SafeRdfModelParser;
import org.openmetadata.service.rdf.rebuild.RdfMutation;

/**
 * Measures every whole-ontology path at one member count: library install per slice, the Studio
 * model load, working snapshot reads and the writes they block, capture, release reads, validation,
 * diff, the RDF projection against the rebuild journal cap, activation and SPARQL. Each run prints
 * one {@code CAPACITY} JSON line and appends it to {@code -Dontology.capacity.report} when set.
 *
 * <p>{@code -Dontology.capacity.members} sets the synthetic size (default 2,000, so the ordinary
 * lane exercises the path quickly), {@code -Dontology.capacity.shape} picks {@code fhir} (classes
 * with several restriction axioms each), {@code fibo} (long IRIs, deep chains) or {@code hub} (one
 * class with every other class as a direct subclass). {@code -Dontology.capacity.fhirPath} and
 * {@code -Dontology.capacity.fiboPath} install the upstream FHIR R5 and FIBO Turtle files; those
 * tests are skipped without a path. A {@code hub} above 10,000 members records every metric and
 * then fails in cleanup: deleting its hub concept exceeds
 * {@code OntologyWriteClosureLimits.CONCEPT_DELETION_IMPACT}, which this test does not raise.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class NativeOntologyCapacityPerfIT extends BaseOntologyApprovalIT {
  private static final int MEMBERS = Integer.getInteger("ontology.capacity.members", 2_000);
  private static final String SHAPE = System.getProperty("ontology.capacity.shape", "fhir");
  private static final String FHIR_PATH = System.getProperty("ontology.capacity.fhirPath");
  private static final String FIBO_PATH = System.getProperty("ontology.capacity.fiboPath");
  private static final String REPORT_PATH = System.getProperty("ontology.capacity.report");
  private static final int SLICE_MEMBERS = NativeOntologyRdfImporter.MAX_CHANGED_DEFINITIONS;
  private static final int PAGE_SIZE = 1000;

  @Test
  void aSyntheticOntologyOfTheConfiguredSizeRoundTripsThroughEveryWholeOntologyPath(
      TestNamespace ns) {
    final String turtle = Synthetic.of(SHAPE, MEMBERS).turtle();
    measure(ns, "synthetic-" + SHAPE, turtle, () -> parseTrusted(turtle));
  }

  @Test
  void theUpstreamFhirR5OntologyRoundTripsThroughEveryWholeOntologyPath(TestNamespace ns) {
    assumeTrue(FHIR_PATH != null, "set -Dontology.capacity.fhirPath to the FHIR R5 Turtle file");
    final String turtle = read(Path.of(FHIR_PATH));
    measure(ns, "fhir-r5", turtle, () -> parseTrusted(turtle));
  }

  @Test
  void theUpstreamFiboQuickstartRoundTripsThroughEveryWholeOntologyPath(TestNamespace ns) {
    assumeTrue(FIBO_PATH != null, "set -Dontology.capacity.fiboPath to the FIBO Turtle file");
    final String turtle = read(Path.of(FIBO_PATH));
    measure(ns, "fibo-quickstart", turtle, () -> parseTrusted(turtle));
  }

  private void measure(
      final TestNamespace ns,
      final String fixture,
      final String turtle,
      final Supplier<Model> models) {
    final Report report = new Report(fixture);
    final Ontology ontology =
        ns.trackRoot(
            "ontology",
            SdkClients.adminClient()
                .ontologies()
                .create(request(ns).withName(ns.prefix("capacity")).withReviewers(null)));
    final var client = SdkClients.adminClient();
    final int expectedMembers = plannedMembers(ontology, models);
    report.put("plannedMembers", expectedMembers);
    System.out.println("CAPACITY_PLAN " + JsonUtils.pojoToJson(report.values));

    final List<Long> sliceMillis = new ArrayList<>();
    final var handler =
        OntologyPackInstallJobHandler.create(
            modules -> models.get(),
            SLICE_MEMBERS,
            real ->
                request -> {
                  final long started = System.nanoTime();
                  real.apply(request);
                  sliceMillis.add(elapsedMillis(started));
                });
    final long jobId = queuedJob(ontology);
    final long installStarted = System.nanoTime();
    handler.runJob(Entity.getJobDAO().fetchJobById(jobId).orElseThrow());
    report.put("installMs", elapsedMillis(installStarted));
    final OntologyPackInstallJob job =
        new OntologyPackInstallJobManager(Entity.getJobDAO(), Clock.systemUTC()).get(jobId);
    assertEquals(OntologyPackInstallJobStatus.COMPLETED, job.getStatus(), job.getError());
    assertEquals(expectedMembers, job.getMemberCount());
    final int members = job.getMemberCount();
    report.put("members", members);
    report.put("slices", job.getTotal());
    report.put("sliceFirstMs", sliceMillis.getFirst());
    report.put("sliceMedianMs", median(sliceMillis));
    report.put("sliceLastMs", sliceMillis.getLast());
    report.put("sliceMaxMs", sliceMillis.stream().mapToLong(Long::longValue).max().orElse(0));

    final long studioStarted = System.nanoTime();
    final int studioDefinitions = studioWorkingLoad(ontology);
    report.put("studioWorkingLoadMs", elapsedMillis(studioStarted));
    report.put("studioWorkingDefinitions", studioDefinitions);

    report.put(
        "workingDiffColdMs",
        millis(() -> client.ontologies().workingDiff(ontology.getId(), 25, null)));
    report.put(
        "workingDiffWarmMs",
        millis(() -> client.ontologies().workingDiff(ontology.getId(), 25, null)));
    report.put(
        "conceptCreateAloneMs",
        millis(() -> declareClass(ontology, "alone", iri(ontology, "alone"))));
    report.put("conceptCreateDuringWorkingDiffMs", createWhileWorkingDiffRuns(ontology));
    report.put(
        "workingValidationMs", millis(() -> client.ontologies().validateWorking(ontology.getId())));

    final Model model = models.get();
    final long triples = model.size();
    model.close();
    report.put("sourceTriples", triples);
    report.put("sourceBytes", turtle.getBytes(StandardCharsets.UTF_8).length);
    if (triples <= SafeRdfModelParser.MAX_TRIPLES
        && turtle.getBytes(StandardCharsets.UTF_8).length <= SafeRdfModelParser.MAX_INPUT_BYTES) {
      final long previewStarted = System.nanoTime();
      final NativeOntologyImportPreview preview =
          client
              .ontologies()
              .previewImport(
                  ontology.getId(),
                  new PreviewNativeOntologyImport()
                      .withFormat(NativeOntologyImportFormat.TURTLE)
                      .withData(turtle));
      report.put("importPreviewMs", elapsedMillis(previewStarted));
      report.put("importPreviewItems", preview.getSummary().getItems().size());
      report.put(
          "importPreviewBytes",
          JsonUtils.pojoToJson(preview).getBytes(StandardCharsets.UTF_8).length);
    }

    final long captureStarted = System.nanoTime();
    final OntologyRelease release =
        client
            .ontologies()
            .capture(
                ontology.getId(),
                new CaptureOntologyRelease()
                    .withExpectedWorkingRevision(
                        client.ontologies().state(ontology.getId()).getWorkingRevision()));
    report.put("captureMs", elapsedMillis(captureStarted));
    report.put("releaseMembers", release.getMemberCount());
    report.put("releaseBytes", release.getTotalBytes());
    assertEquals(members + 3, release.getMemberCount());

    final long releaseLoadStarted = System.nanoTime();
    report.put("studioReleaseLoadDefinitions", studioReleaseLoad(release.getId()));
    report.put("studioReleaseLoadMs", elapsedMillis(releaseLoadStarted));
    final String validation = "/v1/ontologyReleases/" + release.getId() + "/validation";
    report.put("releaseValidationColdMs", millis(() -> get(validation)));
    report.put("releaseValidationWarmMs", millis(() -> get(validation)));
    report.put(
        "releaseDiffColdMs",
        millis(() -> client.ontologyReleases().diff(release.getId(), null, 25, null)));
    report.put(
        "releaseDiffWarmMs",
        millis(() -> client.ontologyReleases().diff(release.getId(), null, 25, null)));

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
    report.put("activationMs", elapsedMillis(activationStarted));
    assertEquals(release.getId(), state.getActiveReleaseId());

    final SparqlQuery count =
        new SparqlQuery().withQuery("SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }");
    final String sparql = "/v1/ontologies/" + ontology.getId() + "/sparql";
    for (int run = 1; run <= 3; run++) {
      final long started = System.nanoTime();
      final JsonNode result =
          client.getHttpClient().execute(HttpMethod.POST, sparql, count, JsonNode.class);
      report.put("sparqlRun" + run + "Ms", elapsedMillis(started));
      final long bindings =
          result.path("results").path("bindings").get(0).path("n").path("value").asLong();
      assertTrue(bindings > 0);
      report.put("sparqlTriples", bindings);
    }
    report.put(
        "workingDiffAfterActivationMs",
        millis(() -> client.ontologies().workingDiff(ontology.getId(), 25, null)));
    report.publish();
  }

  /** What the importer will create, planned the way the install job plans it. */
  private static int plannedMembers(final Ontology ontology, final Supplier<Model> models) {
    final Model model = models.get();
    try {
      return OntologyWorkingSnapshot.production()
          .read(
              ontology.getId(),
              ignored -> {},
              working -> new NativeOntologyRdfImporter().reconcileUnbounded(model, working))
          .getOperations()
          .size();
    } finally {
      model.close();
    }
  }

  private static long createWhileWorkingDiffRuns(final Ontology ontology) {
    final CompletableFuture<Void> diff =
        CompletableFuture.runAsync(
            () -> SdkClients.adminClient().ontologies().workingDiff(ontology.getId(), 25, null));
    try {
      TimeUnit.MILLISECONDS.sleep(50);
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(interrupted);
    }
    final long started = System.nanoTime();
    declareClass(ontology, "during", iri(ontology, "during"));
    final long millis = elapsedMillis(started);
    diff.join();
    return millis;
  }

  private static void projection(final UUID releaseId, final Report report) {
    final CollectionDAO dao = Entity.getCollectionDAO();
    final OntologyRelease release = dao.ontologyReleaseDAO().findEntityById(releaseId);
    final long readStarted = System.nanoTime();
    final var members = new OntologyReleaseReader(dao).read(release, ignored -> {});
    report.put("releaseReadInProcessMs", elapsedMillis(readStarted));
    final long buildStarted = System.nanoTime();
    final Model model = new OntologyReleaseProjection().build(release, members);
    report.put("projectionBuildMs", elapsedMillis(buildStarted));
    try {
      final long encodeStarted = System.nanoTime();
      final ByteArrayOutputStream thrift = new ByteArrayOutputStream();
      RDFDataMgr.write(thrift, model, RDFFormat.RDF_THRIFT);
      report.put("projectionEncodeMs", elapsedMillis(encodeStarted));
      report.put("projectionTriples", model.size());
      report.put("projectionThriftBytes", thrift.size());
      report.put("journalCapBytes", RdfMutation.GraphReplace.MAX_GRAPH_BYTES);
      report.put(
          "projectionFitsJournal", thrift.size() <= RdfMutation.GraphReplace.MAX_GRAPH_BYTES);
    } finally {
      model.close();
    }
  }

  private static int studioWorkingLoad(final Ontology ontology) {
    final String fqn = ontology.getFullyQualifiedName();
    return pages(
            "/v1/ontologyConcepts?ontology="
                + fqn
                + "&fields=conceptMappings,lifecycleStatus,owners,subClasses,superClasses&limit="
                + PAGE_SIZE)
        + pages("/v1/ontologyProperties?ontology=" + fqn + "&limit=" + PAGE_SIZE)
        + pages("/v1/ontologyAxioms?ontologyId=" + ontology.getId() + "&limit=" + PAGE_SIZE);
  }

  private static int studioReleaseLoad(final UUID releaseId) {
    int definitions = 0;
    for (final MemberKind kind :
        List.of(MemberKind.CONCEPT, MemberKind.PROPERTY, MemberKind.AXIOM)) {
      definitions +=
          pages(
              "/v1/ontologyReleases/"
                  + releaseId
                  + "/members/"
                  + kind.value()
                  + "?limit="
                  + PAGE_SIZE);
    }
    return definitions;
  }

  private static int pages(final String path) {
    int loaded = 0;
    String after = null;
    do {
      final JsonNode page = get(after == null ? path : path + "&after=" + after);
      loaded += page.path("data").size();
      after =
          page.path("paging").path("after").isMissingNode()
              ? null
              : page.path("paging").path("after").asText(null);
    } while (after != null);
    return loaded;
  }

  private static JsonNode get(final String path) {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.GET, path, null, JsonNode.class);
  }

  private static long queuedJob(final Ontology ontology) {
    final OntologyPackCatalog catalog = OntologyPackCatalog.bundled();
    final var manifest = catalog.require("fhir");
    final var modules = catalog.select(manifest, Set.of("fhir-r5"));
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
            "queued by capacity test");
  }

  private static URI iri(final Ontology ontology, final String name) {
    return URI.create(ontology.getIri() + "/" + name);
  }

  private static Model parse(final String turtle) {
    return new SafeRdfModelParser().parse(turtle, RdfSerializationFormat.TURTLE);
  }

  private static Model parseTrusted(final String turtle) {
    return new SafeRdfModelParser()
        .parseTrusted(
            turtle,
            RdfSerializationFormat.TURTLE,
            DigestUtils.sha256Hex(turtle.getBytes(StandardCharsets.UTF_8)));
  }

  private static String read(final Path path) {
    try {
      return Files.readString(path);
    } catch (IOException exception) {
      throw new UncheckedIOException(exception);
    }
  }

  private static long millis(final Runnable action) {
    final long started = System.nanoTime();
    action.run();
    return elapsedMillis(started);
  }

  private static long elapsedMillis(final long startedNanos) {
    return Duration.ofNanos(System.nanoTime() - startedNanos).toMillis();
  }

  private static long median(final List<Long> values) {
    final List<Long> sorted = values.stream().sorted().toList();
    return sorted.get(sorted.size() / 2);
  }

  private static final class Report {
    private final Map<String, Object> values = new LinkedHashMap<>();

    Report(final String fixture) {
      values.put("fixture", fixture);
      values.put("db", System.getProperty("databaseType", "unknown"));
    }

    void put(final String key, final Object value) {
      values.put(key, value);
    }

    void publish() {
      final String line = "CAPACITY " + JsonUtils.pojoToJson(values);
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

  /** Synthetic ontologies whose member count and shape follow the upstream standards' shapes. */
  static final class Synthetic {
    private static final String OWL = "@prefix owl: <http://www.w3.org/2002/07/owl#> .\n";
    private static final String RDFS = "@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n";
    private final String shape;
    private final int classes;
    private final int properties;
    private final int axiomsPerClass;

    private Synthetic(
        final String shape, final int classes, final int properties, final int axiomsPerClass) {
      this.shape = shape;
      this.classes = classes;
      this.properties = properties;
      this.axiomsPerClass = axiomsPerClass;
    }

    /**
     * fhir: a class carries one named parent and four restrictions, as FHIR's element classes do.
     * fibo: a class carries one named parent and one existential restriction under a long IRI.
     * hub: every class but the first is a direct subclass of the first.
     */
    static Synthetic of(final String shape, final int members) {
      return switch (shape) {
        case "fhir" -> {
          final int properties = members / 12;
          final int classes = (members - properties) / 6;
          yield new Synthetic(shape, classes, properties, 5);
        }
        case "fibo" -> {
          final int properties = members / 10;
          final int classes = (members - properties) / 3;
          yield new Synthetic(shape, classes, properties, 2);
        }
        case "hub" -> new Synthetic(shape, (members + 1) / 2, 0, 1);
        default -> throw new IllegalArgumentException("Unknown shape " + shape);
      };
    }

    String turtle() {
      final String prefix =
          switch (shape) {
            case "fibo" -> "https://spec.edmcouncil.org/fibo/ontology/FND/Agreements/Contracts/";
            default -> "https://example.org/capacity/" + shape + "/";
          };
      final StringBuilder body =
          new StringBuilder(OWL)
              .append(RDFS)
              .append("@prefix ex: <")
              .append(prefix)
              .append("> .\n");
      body.append("ex:C0 a owl:Class ; rdfs:label \"Root\" .\n");
      body.append(
          IntStream.range(0, properties)
              .mapToObj(
                  i ->
                      "ex:p%d a owl:ObjectProperty ; rdfs:label \"property %d\" ; rdfs:domain ex:C%d ; rdfs:range ex:C%d ."
                          .formatted(i, i, i % classes, (i + 1) % classes))
              .collect(Collectors.joining("\n")));
      body.append('\n');
      for (int i = 1; i < classes; i++) {
        body.append("ex:C").append(i).append(" a owl:Class ; rdfs:label \"Class ").append(i);
        body.append("\" ; rdfs:comment \"Class ").append(i).append(" of the ").append(shape);
        body.append(" fixture, with the longer description an upstream standard carries.\"");
        body.append(" ; rdfs:subClassOf ").append(parent(i)).append(" ");
        for (int restriction = 1; restriction < axiomsPerClass; restriction++) {
          body.append("; rdfs:subClassOf [ a owl:Restriction ; owl:onProperty ex:p")
              .append(properties == 0 ? 0 : (i + restriction) % properties)
              .append(
                  restriction % 2 == 0 ? " ; owl:maxCardinality 1 ] " : " ; owl:allValuesFrom ex:C")
              .append(
                  restriction % 2 == 0 ? "" : String.valueOf((i + restriction) % classes) + " ] ");
        }
        body.append(".\n");
      }
      if (properties == 0 && axiomsPerClass > 1) {
        throw new IllegalStateException("Restrictions need properties");
      }
      return body.toString();
    }

    private String parent(final int i) {
      return switch (shape) {
        case "hub" -> "ex:C0";
        case "fibo" -> "ex:C" + (i % 40 == 1 ? 0 : i - 1);
        default -> "ex:C" + (i / 10);
      };
    }
  }
}
