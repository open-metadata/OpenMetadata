package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BindingRow;
import org.openmetadata.service.ontology.OntologyConceptSqlGenerator.BoundConcept;
import org.openmetadata.service.ontology.OntologyConceptSqlGenerator.BoundTable;

class OntologyConceptQueryServiceTest {
  private static final UUID TRANSFER = new UUID(0xa1, 0);
  private static final UUID CUSTOMER = new UUID(0xa2, 0);

  @Test
  void aReaderWhoMayViewOnlyTheTwelfthBoundTableGetsSqlOverIt() {
    final List<BindingRow> rows = rows(TRANSFER, 12);
    final UUID twelfth = asset(TRANSFER, 12);

    final Map<UUID, List<BindingRow>> visible =
        OntologyConceptQueryService.firstVisibleTables(rows, twelfth::equals);

    assertEquals(Map.of(TRANSFER, List.of(twelfth)), assetIds(visible));
    assertEquals(
        "SELECT transfer_id\nFROM payments.transfers_12\nLIMIT 50",
        OntologyConceptSqlGenerator.generate(
                new BoundConcept(
                    "Funds Transfer",
                    visible.get(TRANSFER).stream()
                        .map(OntologyConceptQueryServiceTest::transfersTable)
                        .toList()),
                List.of())
            .sql());
  }

  @Test
  void eachConceptKeepsItsFirstTenVisibleTablesAndNoHiddenOne() {
    final List<BindingRow> rows =
        List.of(rows(TRANSFER, 14), rows(CUSTOMER, 3)).stream().flatMap(List::stream).toList();
    final Set<UUID> hidden =
        Set.of(asset(TRANSFER, 2), asset(TRANSFER, 5), asset(CUSTOMER, 1), asset(CUSTOMER, 3));

    final Map<UUID, List<BindingRow>> visible =
        OntologyConceptQueryService.firstVisibleTables(rows, id -> !hidden.contains(id));

    assertEquals(
        Map.of(
            TRANSFER,
            IntStream.of(1, 3, 4, 6, 7, 8, 9, 10, 11, 12)
                .mapToObj(index -> asset(TRANSFER, index))
                .toList(),
            CUSTOMER,
            List.of(asset(CUSTOMER, 2))),
        assetIds(visible));
  }

  private static List<BindingRow> rows(final UUID concept, final int count) {
    return IntStream.rangeClosed(1, count)
        .mapToObj(
            index ->
                new BindingRow(
                    concept,
                    asset(concept, index),
                    OntologyBindingAssetType.TABLE,
                    "hash" + index,
                    List.of()))
        .toList();
  }

  private static UUID asset(final UUID concept, final int index) {
    return new UUID(concept.getMostSignificantBits(), index);
  }

  private static Map<UUID, List<UUID>> assetIds(final Map<UUID, List<BindingRow>> rows) {
    return rows.entrySet().stream()
        .collect(
            Collectors.toMap(
                Map.Entry::getKey,
                entry -> entry.getValue().stream().map(BindingRow::assetId).toList()));
  }

  private static BoundTable transfersTable(final BindingRow row) {
    return new BoundTable(
        "finance.warehouse.payments.transfers_" + row.assetId().getLeastSignificantBits(),
        "Postgres",
        List.of(List.of("transfer_id")),
        Map.of(),
        List.of(),
        List.of());
  }
}
