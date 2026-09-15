package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.tests.EntityTransactionBoundaryIT.TransactionCounter;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlFailureProbe;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ChartRepository;

@ExtendWith(TestNamespaceExtension.class)
@Isolated("Counts create-many transactions and injects failures after real relationship writes")
class EntityCreateManyIT {
  @BeforeAll
  static void initialize() {
    SdkClients.adminClient();
  }

  @Test
  void glossaryApiReturnsCreatedTermsInOrderWithReadableAliases(TestNamespace ns) {
    final var glossary = GlossaryTestFactory.createSimple(ns);
    final List<CreateGlossaryTerm> requests =
        List.of("first", "second").stream()
            .map(
                name ->
                    new CreateGlossaryTerm()
                        .withName(ns.prefix(name))
                        .withDescription("Created together")
                        .withGlossary(glossary.getFullyQualifiedName()))
            .toList();
    final GlossaryTerm[] created =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.POST, "/v1/glossaryTerms/createMany", requests, GlossaryTerm[].class);
    assertEquals(requests.size(), created.length);
    for (int index = 0; index < created.length; index++) {
      final GlossaryTerm term = created[index];
      assertEquals(requests.get(index).getName(), term.getName());
      assertEquals(glossary.getId(), term.getGlossary().getId());
      assertEquals(0.1, term.getVersion());
      assertTermAliases(term);
    }
  }

  @Test
  void rowsAndRelationshipsCommitOnceBeforeTheBatchReturns(TestNamespace ns) {
    final List<Chart> charts = charts(ns, 2);
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      final List<Chart> created = repository().createMany(null, charts);
      assertEquals(
          charts.stream().map(Chart::getId).toList(), created.stream().map(Chart::getId).toList());
      assertEquals(1, transactions.commits());
      assertEquals(0, transactions.rollbacks());
    }
    charts.forEach(this::assertChartAliases);
  }

  @Test
  void relationshipFailureRollsBackEveryRowInTheOwningChunk(TestNamespace ns) {
    final List<Chart> charts = charts(ns, 2);
    try (var transactions = new TransactionCounter(Entity.getJdbi());
        var failure =
            new SqlFailureProbe(
                Entity.getJdbi(),
                "into entity_relationship",
                () -> new IllegalStateException("Failure after create-many relationship write"))) {
      assertThrows(RuntimeException.class, () -> repository().createMany(null, charts));
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    charts.forEach(this::assertNotStored);
  }

  @Test
  void existingChunkLimitKeepsLargeCreatesBounded(TestNamespace ns) {
    final List<Chart> charts = charts(ns, 101);
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      repository().createMany(null, charts);
      assertEquals(2, transactions.commits());
      assertEquals(0, transactions.rollbacks());
    }
    assertChartAliases(charts.getFirst());
    assertChartAliases(charts.getLast());
    assertEquals(101, storedRows(charts));
  }

  @Test
  void anEnclosingTransactionOwnsEveryChunkAndRollsThemBackTogether(TestNamespace ns) {
    final List<Chart> charts = charts(ns, 101);
    try (var transactions = new TransactionCounter(Entity.getJdbi())) {
      assertThrows(
          IllegalStateException.class,
          () ->
              repository()
                  .executeInTransaction(
                      () -> {
                        repository().createMany(null, charts);
                        assertEquals(101, storedRows(charts));
                        throw new IllegalStateException("Failure in enclosing create transaction");
                      }));
      assertEquals(0, transactions.commits());
      assertEquals(1, transactions.rollbacks());
    }
    assertEquals(0, storedRows(charts));
    assertNotStored(charts.getFirst());
    assertNotStored(charts.getLast());
  }

  private List<Chart> charts(TestNamespace ns, int count) {
    final var service = DashboardServiceTestFactory.createMetabase(ns);
    return IntStream.range(0, count)
        .mapToObj(
            index ->
                new Chart()
                    .withId(UUID.randomUUID())
                    .withName(ns.prefix("chart_" + index))
                    .withService(service.getEntityReference())
                    .withDescription("Created together")
                    .withVersion(0.1)
                    .withUpdatedBy("admin")
                    .withUpdatedAt(System.currentTimeMillis()))
        .toList();
  }

  private static void assertTermAliases(GlossaryTerm expected) {
    final var terms = SdkClients.adminClient().glossaryTerms();
    for (final GlossaryTerm actual :
        List.of(terms.get(expected.getId()), terms.getByName(expected.getFullyQualifiedName()))) {
      assertEquals(expected.getId(), actual.getId());
      assertEquals(expected.getDescription(), actual.getDescription());
      assertEquals(expected.getGlossary().getId(), actual.getGlossary().getId());
      assertEquals(expected.getVersion(), actual.getVersion());
    }
  }

  private void assertChartAliases(Chart expected) {
    final var charts = SdkClients.adminClient().charts();
    for (final Chart actual :
        List.of(charts.get(expected.getId()), charts.getByName(expected.getFullyQualifiedName()))) {
      assertEquals(expected.getId(), actual.getId());
      assertEquals(expected.getDescription(), actual.getDescription());
      assertEquals(expected.getService().getId(), actual.getService().getId());
      assertEquals(0.1, actual.getVersion());
    }
    assertEquals(1, relationshipCount(expected.getId()));
  }

  private void assertNotStored(Chart chart) {
    final var rows = repository().getDao();
    assertNull(rows.findById(rows.getTableName(), chart.getId(), ""));
    assertEquals(0, relationshipCount(chart.getId()));
    final var charts = SdkClients.adminClient().charts();
    assertEquals(
        404,
        assertThrows(OpenMetadataException.class, () -> charts.get(chart.getId())).getStatusCode());
    assertEquals(
        404,
        assertThrows(
                OpenMetadataException.class, () -> charts.getByName(chart.getFullyQualifiedName()))
            .getStatusCode());
  }

  private static int storedRows(List<Chart> charts) {
    final var rows = repository().getDao();
    return rows.findExistingIds(
            rows.getTableName(), charts.stream().map(chart -> chart.getId().toString()).toList())
        .size();
  }

  private static int relationshipCount(UUID id) {
    return Entity.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM entity_relationship WHERE toId = :id")
                    .bind("id", id.toString())
                    .mapTo(Integer.class)
                    .one());
  }

  private static ChartRepository repository() {
    return (ChartRepository) Entity.getEntityRepository(Entity.CHART);
  }
}
