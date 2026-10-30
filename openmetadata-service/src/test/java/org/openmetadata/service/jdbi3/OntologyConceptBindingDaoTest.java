package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.migrate;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.withDatabase;

import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class OntologyConceptBindingDaoTest {
  private static final UUID TRANSFER = new UUID(0xa1, 0);
  private static final UUID CUSTOMER = new UUID(0xa2, 0);
  private static final UUID UNBOUND = new UUID(0xa3, 0);

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void firstTablesReadsTheEarliestTableRowsOfEveryConceptInOneStatement(
      final ConnectionType dialect) {
    withDatabase(
        dialect,
        handle -> {
          handle.execute("DROP TABLE IF EXISTS ontology_concept_binding");
          migrate(handle, dialect);
          bind(handle, TRANSFER, 1, "topic");
          bind(handle, TRANSFER, 4, "table");
          bind(handle, TRANSFER, 2, "table");
          bind(handle, TRANSFER, 3, "table");
          bind(handle, CUSTOMER, 9, "table");

          final var rows =
              handle
                  .attach(CollectionDAO.class)
                  .ontologyConceptBindingDAO()
                  .listFirstTablesForConcepts(
                      List.of(TRANSFER.toString(), CUSTOMER.toString(), UNBOUND.toString()), 2);

          assertEquals(
              List.of(
                  TRANSFER + "/" + asset(2), TRANSFER + "/" + asset(3), CUSTOMER + "/" + asset(9)),
              rows.stream().map(row -> row.conceptId() + "/" + row.assetId()).toList());
        });
  }

  private static void bind(
      final Handle handle, final UUID concept, final int asset, final String assetType) {
    handle.execute(
        "INSERT INTO ontology_concept_binding (conceptId, assetId, assetType, assetFqnHash, columnBindings) VALUES (?, ?, ?, ?, '[]')",
        concept.toString(),
        asset(asset).toString(),
        assetType,
        "hash" + asset);
  }

  private static UUID asset(final int index) {
    return new UUID(0, index);
  }
}
