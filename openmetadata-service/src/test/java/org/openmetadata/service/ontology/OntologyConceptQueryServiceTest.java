package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.schema.api.data.OntologyConceptQueryDirection.INCOMING;
import static org.openmetadata.schema.api.data.OntologyConceptQueryDirection.OUTGOING;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyBindingAssetType;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.OntologyConceptBindingDAO.BindingRow;
import org.openmetadata.service.ontology.OntologyConceptSqlGenerator.BoundConcept;
import org.openmetadata.service.ontology.OntologyConceptSqlGenerator.BoundTable;
import org.openmetadata.service.ontology.OntologyConceptSqlGenerator.Hop;

class OntologyConceptQueryServiceTest {
  private static final UUID TRANSFER = new UUID(0xa1, 0);
  private static final UUID CUSTOMER = new UUID(0xa2, 0);
  private static final URI EMPLOYEE_IRI = URI.create("urn:hr:Employee");
  private static final URI MANAGER_IRI = URI.create("urn:hr:Manager");
  private static final URI MANAGES_IRI = URI.create("urn:hr:manages");
  private static final URI MANAGED_BY_IRI = URI.create("urn:hr:managedBy");

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

  @Test
  void aHopFollowedBackAgainstItsRelationReadsAsTheDeclaredInverse() {
    final URI transferIri = URI.create("urn:payments:FundsTransfer");
    final URI customerIri = URI.create("urn:payments:Customer");
    final URI hasPartIri = URI.create("urn:payments:hasPart");
    final OntologyProperty partOf =
        new OntologyProperty()
            .withName("partOf")
            .withKind(OntologyPropertyKind.OBJECT)
            .withDomain(List.of(transferIri))
            .withRange(List.of(customerIri))
            .withInverse(hasPartIri);
    final OntologyProperty hasPart =
        new OntologyProperty()
            .withName("hasPart")
            .withKind(OntologyPropertyKind.OBJECT)
            .withIri(hasPartIri);
    final BoundTable customers =
        new BoundTable(
            "finance.warehouse.payments.customers",
            "Postgres",
            List.of(List.of("name")),
            Map.of(),
            List.of(),
            List.of());
    final BoundTable transfers =
        new BoundTable(
            "finance.warehouse.payments.transfers",
            "Postgres",
            List.of(List.of("transfer_id")),
            Map.of(),
            List.of(),
            List.of(
                new TableConstraint()
                    .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
                    .withColumns(List.of("customer_id"))
                    .withReferredColumns(
                        List.of("finance.warehouse.payments.customers.customer_id"))));

    assertEquals("part of", OntologyConceptQueryService.hopLabel(OUTGOING, partOf, hasPart));
    assertEquals("part of", OntologyConceptQueryService.hopLabel(INCOMING, partOf, null));
    assertEquals(
        "SELECT t1.transfer_id\nFROM payments.customers t0\n"
            + "JOIN payments.transfers t1 ON t0.customer_id = t1.customer_id -- has part\nLIMIT 50",
        OntologyConceptSqlGenerator.generate(
                new BoundConcept("Customer", List.of(customers)),
                List.of(
                    new Hop(
                        UUID.randomUUID(),
                        null,
                        OntologyConceptQueryService.hopLabel(INCOMING, partOf, hasPart),
                        new BoundConcept("Funds Transfer", List.of(transfers)))))
            .sql());
  }

  @Test
  void anInverseTheReaderMayNotViewStillOrientsASelfRelationAndNamesNothing() {
    final URI employeeIri = URI.create("urn:hr:Employee");
    final URI managesIri = URI.create("urn:hr:manages");
    final URI managedByIri = URI.create("urn:hr:managedBy");
    final OntologyProperty manages =
        new OntologyProperty()
            .withId(UUID.randomUUID())
            .withName("manages")
            .withKind(OntologyPropertyKind.OBJECT)
            .withIri(managesIri)
            .withDomain(List.of(employeeIri))
            .withRange(List.of(employeeIri))
            .withInverse(managedByIri);
    final OntologyProperty managedBy =
        new OntologyProperty()
            .withId(UUID.randomUUID())
            .withName("managedBy")
            .withKind(OntologyPropertyKind.OBJECT)
            .withIri(managedByIri)
            .withDomain(List.of(employeeIri))
            .withRange(List.of(employeeIri))
            .withInverse(managesIri);
    final BoundConcept employees =
        new BoundConcept(
            "Employee",
            List.of(
                new BoundTable(
                    "finance.warehouse.payments.employees",
                    "Postgres",
                    List.of(List.of("employee_id"), List.of("manager_id")),
                    Map.of(managedBy.getId(), List.of("manager_id")),
                    List.of(),
                    List.of(
                        new TableConstraint()
                            .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
                            .withColumns(List.of("manager_id"))
                            .withReferredColumns(
                                List.of("finance.warehouse.payments.employees.employee_id"))))));

    final Hop hop =
        OntologyConceptQueryService.hop(
            manages,
            OUTGOING,
            OntologyConceptQueryService.Inverses.of(List.of(managedBy), property -> false),
            employees);

    assertEquals("manages", hop.label());
    assertEquals(
        "SELECT t1.employee_id, t1.manager_id\nFROM payments.employees t0\n"
            + "JOIN payments.employees t1 ON t0.employee_id = t1.manager_id -- manages\n"
            + "LIMIT 50",
        OntologyConceptSqlGenerator.generate(employees, List.of(hop)).sql());
  }

  @Test
  void aHopFollowedFromItsRangeJoinsTheWayItsLabelReads() {
    final OntologyProperty manages = manages();
    final OntologyProperty managedBy = managedBy(manages);
    final OntologyConceptQueryService.Inverses inverses =
        OntologyConceptQueryService.Inverses.of(List.of(manages, managedBy), property -> true);
    final BoundConcept employees = managerBoundEmployees("Employee", managedBy);
    final BoundConcept managers = managerBoundEmployees("Manager", managedBy);

    assertAll(
        () ->
            assertEquals(
                employeesJoinedOn("t0.manager_id = t1.employee_id -- managed by"),
                sql(
                    employees,
                    OntologyConceptQueryService.hop(managedBy, OUTGOING, inverses, managers)),
                "Employee to Manager over managed by"),
        () ->
            assertEquals(
                employeesJoinedOn("t0.manager_id = t1.employee_id -- managed by"),
                sql(
                    employees,
                    OntologyConceptQueryService.hop(manages, INCOMING, inverses, managers)),
                "Employee to Manager over manages, followed from its range"),
        () ->
            assertEquals(
                employeesJoinedOn("t0.employee_id = t1.manager_id -- manages"),
                sql(
                    managers,
                    OntologyConceptQueryService.hop(manages, OUTGOING, inverses, employees)),
                "Manager to Employee over manages"),
        () ->
            assertEquals(
                employeesJoinedOn("t0.employee_id = t1.manager_id -- manages"),
                sql(
                    managers,
                    OntologyConceptQueryService.hop(managedBy, INCOMING, inverses, employees)),
                "Manager to Employee over managed by, followed from its range"));
  }

  @Test
  void aHopFollowedFromItsRangeOverAHiddenInverseJoinsTheSameWayAndNamesOnlyItsOwnProperty() {
    final OntologyProperty manages = manages();
    final OntologyProperty managedBy = managedBy(manages);
    final BoundConcept employees = managerBoundEmployees("Employee", managedBy);

    final Hop hop =
        OntologyConceptQueryService.hop(
            manages,
            INCOMING,
            OntologyConceptQueryService.Inverses.of(
                List.of(manages, managedBy), property -> property == manages),
            managerBoundEmployees("Manager", managedBy));

    assertEquals("manages", hop.label());
    assertEquals(
        employeesJoinedOn("t0.manager_id = t1.employee_id -- manages"), sql(employees, hop));
  }

  @Test
  void anOutgoingChipFromAConceptOnlyInTheRangeFollowsItsOwnProperty() {
    final OntologyProperty manages = manages();
    final OntologyProperty managedBy = managedBy(manages);
    final BoundConcept managers = managerBoundEmployees("Manager", managedBy);

    final Hop hop =
        OntologyConceptQueryService.hop(
            managedBy,
            OUTGOING,
            OntologyConceptQueryService.Inverses.of(List.of(manages, managedBy), property -> true),
            managers);

    assertEquals("managed by", hop.label());
    assertEquals(
        employeesJoinedOn("t0.manager_id = t1.employee_id -- managed by"), sql(managers, hop));
  }

  @Test
  void anIncomingChipToAConceptOutsideTheDomainRunsOverTheInverse() {
    final OntologyProperty manages = manages();
    final OntologyProperty managedBy = managedBy(manages);

    final Hop hop =
        OntologyConceptQueryService.hop(
            managedBy,
            INCOMING,
            OntologyConceptQueryService.Inverses.of(List.of(manages, managedBy), property -> true),
            managerBoundEmployees("Director", managedBy));

    assertEquals("manages", hop.label());
    assertEquals(
        employeesJoinedOn("t0.employee_id = t1.manager_id -- manages"),
        sql(managerBoundEmployees("Manager", managedBy), hop));
  }

  @Test
  void aHiddenInverseBoundInSeveralCompositeKeysNamesTheBoundColumn() {
    final OntologyProperty manages = manages();
    final OntologyProperty managedBy = managedBy(manages);
    final List<TableConstraint> keys =
        List.of(
            compositeSelfKey("manager_id", "tenant_id", "employee_id", "tenant_id"),
            compositeSelfKey("manager_id", "region", "employee_id", "region"));

    final Hop hop =
        OntologyConceptQueryService.hop(
            manages,
            INCOMING,
            OntologyConceptQueryService.Inverses.of(
                List.of(manages, managedBy), property -> property == manages),
            managerBoundEmployees("Manager", managedBy, keys));

    assertEquals(
        "Hop 1 (manages): manager_id is in several foreign keys between "
            + "finance.warehouse.payments.employees and finance.warehouse.payments.employees",
        assertThrows(
                BadRequestException.class,
                () -> sql(managerBoundEmployees("Employee", managedBy, keys), hop))
            .getMessage());
  }

  @Test
  void aHopWhosePropertyDeclaresNoInverseKeepsItsPropertyAndLabel() {
    final OntologyProperty reportsTo =
        new OntologyProperty()
            .withId(UUID.randomUUID())
            .withName("reportsTo")
            .withKind(OntologyPropertyKind.OBJECT)
            .withDomain(List.of(MANAGER_IRI))
            .withRange(List.of(EMPLOYEE_IRI));

    final Hop hop =
        OntologyConceptQueryService.hop(
            reportsTo,
            INCOMING,
            OntologyConceptQueryService.Inverses.NONE,
            new BoundConcept("Manager", List.of()));

    assertEquals(reportsTo.getId(), hop.property());
    assertNull(hop.inverse());
    assertEquals("reports to", hop.label());
  }

  private static OntologyProperty manages() {
    return new OntologyProperty()
        .withId(UUID.randomUUID())
        .withName("manages")
        .withKind(OntologyPropertyKind.OBJECT)
        .withIri(MANAGES_IRI)
        .withDomain(List.of(MANAGER_IRI))
        .withRange(List.of(EMPLOYEE_IRI))
        .withInverse(MANAGED_BY_IRI);
  }

  private static OntologyProperty managedBy(final OntologyProperty manages) {
    return new OntologyProperty()
        .withId(UUID.randomUUID())
        .withName("managedBy")
        .withKind(OntologyPropertyKind.OBJECT)
        .withIri(MANAGED_BY_IRI)
        .withDomain(List.of(EMPLOYEE_IRI))
        .withRange(List.of(MANAGER_IRI))
        .withInverse(manages.getIri());
  }

  private static BoundConcept managerBoundEmployees(
      final String label, final OntologyProperty managedBy) {
    return managerBoundEmployees(
        label,
        managedBy,
        List.of(
            new TableConstraint()
                .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
                .withColumns(List.of("manager_id"))
                .withReferredColumns(List.of("finance.warehouse.payments.employees.employee_id"))));
  }

  private static BoundConcept managerBoundEmployees(
      final String label, final OntologyProperty managedBy, final List<TableConstraint> keys) {
    return new BoundConcept(
        label,
        List.of(
            new BoundTable(
                "finance.warehouse.payments.employees",
                "Postgres",
                List.of(List.of("employee_id"), List.of("manager_id")),
                Map.of(managedBy.getId(), List.of("manager_id")),
                List.of(),
                keys)));
  }

  private static TableConstraint compositeSelfKey(
      final String column, final String other, final String referred, final String otherReferred) {
    return new TableConstraint()
        .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
        .withColumns(List.of(column, other))
        .withReferredColumns(
            List.of(
                "finance.warehouse.payments.employees." + referred,
                "finance.warehouse.payments.employees." + otherReferred));
  }

  private static String employeesJoinedOn(final String on) {
    return "SELECT t1.employee_id, t1.manager_id\nFROM payments.employees t0\n"
        + "JOIN payments.employees t1 ON "
        + on
        + "\nLIMIT 50";
  }

  private static String sql(final BoundConcept from, final Hop hop) {
    return OntologyConceptSqlGenerator.generate(from, List.of(hop)).sql();
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
