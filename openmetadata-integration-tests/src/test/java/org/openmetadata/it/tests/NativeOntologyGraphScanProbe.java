package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.OntologyBindingFixtures.admin;
import static org.openmetadata.it.tests.OntologyBindingFixtures.graph;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigInteger;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import java.util.regex.Pattern;
import java.util.stream.IntStream;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.codec.digest.DigestUtils;
import org.jdbi.v3.core.statement.StatementContext;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.monitoring.RequestLatencyContext;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Seeds binding and axiom rows straight into the embedded database and counts the rows each scan
 * statement maps while a request is served. Only for tests that run against the embedded server.
 */
@Slf4j
final class NativeOntologyGraphScanProbe {
  private NativeOntologyGraphScanProbe() {}

  /** Inserts {@code count} binding rows to topics that do not exist, ids ascending from after. */
  static void insertMissingBindings(
      final OntologyConcept concept, final UUID after, final int count) {
    Entity.getJdbi()
        .useHandle(
            handle -> {
              final var batch =
                  handle.prepareBatch(
                      "INSERT INTO ontology_concept_binding "
                          + "(conceptId, assetId, assetType, assetFqnHash, columnBindings) "
                          + "VALUES (:conceptId, :assetId, 'topic', :hash, '[]')");
              for (int index = 1; index <= count; index++) {
                final var id = shift(after, index);
                batch
                    .bind("conceptId", concept.getId().toString())
                    .bind("assetId", id.toString())
                    .bind("hash", "missing-" + id)
                    .add();
              }
              batch.execute();
            });
  }

  static UUID shift(final UUID id, final int distance) {
    final var value =
        new BigInteger(id.toString().replace("-", ""), 16).add(BigInteger.valueOf(distance));
    final var hex = "%032x".formatted(value);
    return UUID.fromString(
        hex.substring(0, 8)
            + "-"
            + hex.substring(8, 12)
            + "-"
            + hex.substring(12, 16)
            + "-"
            + hex.substring(16, 20)
            + "-"
            + hex.substring(20));
  }

  static List<UUID> insertIrrelevantAxioms(
      final Ontology ontology, final OntologyAxiom template, final int count) {
    return insertAxiomClones(
        ontology,
        template,
        IntStream.range(0, count)
            .mapToObj(
                index ->
                    new AxiomClone(
                        UUID.randomUUID(),
                        "aaaCandidate%04d".formatted(index),
                        template.getTargetIri()))
            .toList());
  }

  record AxiomClone(UUID id, String name, URI target) {}

  static List<UUID> insertAxiomClones(
      final Ontology ontology, final OntologyAxiom template, final List<AxiomClone> clones) {
    final var jsonCast =
        TestSuiteBootstrap.getConnectionType() == ConnectionType.POSTGRES
            ? "CAST(:json AS JSONB)"
            : ":json";
    Entity.getJdbi()
        .useTransaction(
            handle -> {
              final var axioms =
                  handle.prepareBatch(
                      "INSERT INTO ontology_axiom_entity (fqnHash, json) VALUES (:hash, "
                          + jsonCast
                          + ")");
              final var references =
                  handle.prepareBatch(
                      "INSERT INTO ontology_reference "
                          + "(ontologyId, sourceType, sourceId, role, iri, iriHash) "
                          + "VALUES (:ontologyId, 'ontologyAxiom', :sourceId, "
                          + "'AXIOM_SUBJECT', :iri, :iriHash)");
              for (final var clone : clones) {
                final var fqn =
                    FullyQualifiedName.add(ontology.getFullyQualifiedName(), clone.name());
                final var document = (ObjectNode) JsonUtils.valueToTree(template);
                document.put("id", clone.id().toString());
                document.put("name", clone.name());
                document.put("fullyQualifiedName", fqn);
                document.put("targetIri", clone.target().toString());
                axioms
                    .bind("hash", FullyQualifiedName.buildHash(fqn))
                    .bind("json", document.toString())
                    .add();
                references
                    .bind("ontologyId", ontology.getId().toString())
                    .bind("sourceId", clone.id().toString())
                    .bind("iri", template.getSubjectIri().toString())
                    .bind("iriHash", DigestUtils.sha256Hex(template.getSubjectIri().toString()))
                    .add();
              }
              axioms.execute();
              references.execute();
            });
    return new ArrayList<>(clones.stream().map(AxiomClone::id).toList());
  }

  static void deleteAxiomClones(final List<UUID> ids) {
    Entity.getJdbi()
        .useHandle(
            handle -> {
              final var references =
                  handle.prepareBatch(
                      "DELETE FROM ontology_reference WHERE sourceType = 'ontologyAxiom' AND sourceId = :id");
              final var axioms =
                  handle.prepareBatch("DELETE FROM ontology_axiom_entity WHERE id = :id");
              ids.forEach(
                  id -> {
                    references.bind("id", id.toString()).add();
                    axioms.bind("id", id.toString()).add();
                  });
              references.execute();
              axioms.execute();
            });
  }

  static void assertAxiomNameOrdering(
      final Ontology ontology, final List<String> names, final List<UUID> ids) {
    Entity.getJdbi()
        .useHandle(
            handle -> {
              final var ordered =
                  handle
                      .createQuery(
                          "SELECT id FROM ontology_axiom_entity WHERE ontologyId = :ontologyId "
                              + "AND name IN (<names>) ORDER BY name, id")
                      .bind("ontologyId", ontology.getId().toString())
                      .bindList("names", names)
                      .mapTo(String.class)
                      .list();
              assertEquals(ids.stream().map(UUID::toString).toList(), ordered);
              final int equalNames =
                  handle
                      .createQuery(
                          "SELECT COUNT(*) FROM ontology_axiom_entity WHERE ontologyId = :ontologyId AND name = :name")
                      .bind("ontologyId", ontology.getId().toString())
                      .bind("name", names.getFirst())
                      .mapTo(Integer.class)
                      .one();
              if (TestSuiteBootstrap.getConnectionType() == ConnectionType.MYSQL) {
                assertEquals(
                    "utf8mb4_0900_ai_ci",
                    handle
                        .createQuery(
                            "SELECT COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
                                + "AND TABLE_NAME = 'ontology_axiom_entity' AND COLUMN_NAME = 'name'")
                        .mapTo(String.class)
                        .one());
                assertEquals(3, equalNames);
              } else {
                assertEquals(1, equalNames);
              }
            });
  }

  static void assertInvisibleBindingRows(final Ontology ontology, final List<Long> expectedRows) {
    final var observed = new ScanObservation();
    final var graph = observed.watch(() -> graph(admin(), ontology, ""));
    assertEquals(1, graph.getPaging().getTotal());
    assertEquals(List.of(), graph.getClusters());
    assertEquals(List.of(), graph.getEdges());
    assertEquals(expectedRows, observed.bindingRows());
    observed.assertBounded();
  }

  /** The SQL statements one first-page graph read runs, each logged with its request. */
  static int reads(final OpenMetadataClient client, final Ontology ontology) {
    final var sequence = new AtomicInteger();
    try (var queries =
        SqlQueryCounter.forRequests(
            Entity.getJdbi(),
            "select",
            statement -> {
              final var sql = statement.getRenderedSql();
              if (sql.toLowerCase(Locale.ROOT).contains("select")) {
                final var request = RequestLatencyContext.getContext();
                log.info(
                    "Graph budget SQL ontology={} sequence={} request={} method={} path={} thread={} sql={}",
                    ontology.getId(),
                    sequence.incrementAndGet(),
                    System.identityHashCode(request),
                    request.getMethod(),
                    request.getUriPath(),
                    Thread.currentThread().getName(),
                    sql);
              }
              return true;
            })) {
      final var graph = graph(client, ontology, "");
      assertEquals(Math.min(12, graph.getPaging().getTotal()), graph.getClusters().size());
      return queries.count();
    }
  }

  /** The rows each binding and axiom scan statement mapped while a request was served. */
  static final class ScanObservation {
    private static final Pattern IN_LIST = Pattern.compile("\\bin\\s*\\(([^)]*)\\)");
    private static final int PAGE = 500;
    private final List<Long> bindingRows = new CopyOnWriteArrayList<>();
    private final List<Long> axiomRows = new CopyOnWriteArrayList<>();
    private final AtomicInteger largestInList = new AtomicInteger();
    private final AtomicBoolean boundedRows = new AtomicBoolean(true);

    <T> T watch(final Supplier<T> request) {
      try (var queries = SqlQueryCounter.forRequests(Entity.getJdbi(), "select", this::record)) {
        return request.get();
      }
    }

    void run(final Runnable request) {
      watch(
          () -> {
            request.run();
            return null;
          });
    }

    List<Long> bindingRows() {
      return List.copyOf(bindingRows);
    }

    List<Long> axiomRows() {
      return List.copyOf(axiomRows);
    }

    int largestInList() {
      return largestInList.get();
    }

    private boolean record(final StatementContext statement) {
      final var sql = statement.getRenderedSql().toLowerCase(Locale.ROOT);
      if (!sql.contains("select")) {
        return false;
      }
      final var lists = IN_LIST.matcher(sql);
      while (lists.find()) {
        largestInList.accumulateAndGet(lists.group(1).split(",").length, Math::max);
      }
      final var rows = scanRows(sql);
      if (rows != null) {
        boundedRows.compareAndSet(true, sql.contains(" limit "));
        statement.addCleanable(
            () -> {
              rows.add(statement.getMappedRows());
              log.info("Graph scan SQL mappedRows={} sql={}", statement.getMappedRows(), sql);
            });
      }
      return true;
    }

    private List<Long> scanRows(final String sql) {
      if (sql.contains("from ontology_concept_binding") && !sql.contains("count(")) {
        return bindingRows;
      }
      if (sql.contains("from ontology_axiom_entity a") && sql.contains("axiom_subject")) {
        return axiomRows;
      }
      return null;
    }

    void assertBounded() {
      assertTrue(boundedRows.get(), "Every scan query must carry LIMIT");
      assertTrue(bindingRows.stream().allMatch(rows -> rows <= PAGE), bindingRows.toString());
      assertTrue(axiomRows.stream().allMatch(rows -> rows <= PAGE), axiomRows.toString());
      assertTrue(
          largestInList.get() <= PAGE, "The widest observed SQL IN list was " + largestInList);
    }
  }
}
