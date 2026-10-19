package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.net.URI;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.service.Entity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Isolated("Counts SQL statements while exercising release authorization over HTTP")
@ExtendWith(TestNamespaceExtension.class)
class IndependentOntologyAuthorizationIT extends BaseOntologyApprovalIT {
  private static final Logger LOG =
      LoggerFactory.getLogger(IndependentOntologyAuthorizationIT.class);

  @Test
  void captureAndReleaseReadsLoadPermissionsPerPageInsteadOfPerDefinition(TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Counts the embedded server's SQL statements");
    final Ontology ontology = createOntology(ns);
    addConcepts(ontology, 0, 4);
    final Reads narrow = reads(ontology, 5);
    addConcepts(ontology, 4, 40);
    final Reads wide = reads(ontology, 41);
    LOG.info("Release SQL reads for 4 versus 40 concepts: {} -> {}", narrow, wide);

    assertTrue(
        narrow.capture() > 0 && narrow.structure() > 0,
        "The SQL probe must observe both requests: " + narrow);
    assertTrue(
        wide.capture() <= narrow.capture() + 12,
        "Definitions on the same page must not add authorization queries: "
            + narrow
            + " -> "
            + wide);
    assertTrue(
        wide.structure() <= narrow.structure() + 12,
        "Reading a sealed page must batch current permissions: " + narrow + " -> " + wide);
  }

  private static void addConcepts(Ontology ontology, int from, int to) {
    for (int index = from; index < to; index++) {
      declareClass(
          ontology, "Concept" + index, URI.create(ontology.getNamespace() + "Concept" + index));
    }
  }

  private static Reads reads(Ontology ontology, int members) {
    final OntologyRelease release;
    final int captureQueries;
    try (var queries = countReads()) {
      release = capture(ontology);
      captureQueries = queries.count();
    }
    assertEquals(members, release.getMemberCount());
    try (var queries = countReads()) {
      assertTrue(SdkClients.adminClient().ontologyReleases().structure(release.getId()).getValid());
      return new Reads(captureQueries, queries.count());
    }
  }

  private static SqlQueryCounter countReads() {
    // Each sealed member uses INSERT ... SELECT; those writes are not authorization reads.
    return SqlQueryCounter.forRequests(
        Entity.getJdbi(),
        "select",
        statement ->
            !statement
                .getRenderedSql()
                .toLowerCase(Locale.ROOT)
                .contains("insert into ontology_release_member"));
  }

  private record Reads(int capture, int structure) {}
}
