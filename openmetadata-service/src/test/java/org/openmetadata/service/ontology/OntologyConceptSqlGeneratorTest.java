package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyConceptQueryDialect;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.OntologyConceptSqlGenerator.BoundConcept;
import org.openmetadata.service.ontology.OntologyConceptSqlGenerator.BoundTable;
import org.openmetadata.service.ontology.OntologyConceptSqlGenerator.Generated;
import org.openmetadata.service.ontology.OntologyConceptSqlGenerator.Hop;

class OntologyConceptSqlGeneratorTest {
  private static final String TRANSFERS = "finance.warehouse.payments.transfers";
  private static final String CUSTOMERS = "finance.warehouse.payments.customers";
  private static final String ACCOUNTS = "finance.warehouse.payments.accounts";
  private static final String LEDGER = "finance.warehouse.payments.ledger";
  private static final String EMPLOYEES = "finance.warehouse.payments.employees";
  private static final UUID PART_OF = UUID.randomUUID();
  private static final UUID PAID_BY = UUID.randomUUID();
  private static final UUID RECEIVED_BY = UUID.randomUUID();
  private static final UUID HOLDS = UUID.randomUUID();
  private static final UUID MANAGED_BY = UUID.randomUUID();
  private static final UUID MANAGES = UUID.randomUUID();
  private static final UUID PRIMARY_ACCOUNT = UUID.randomUUID();
  private static final UUID PRIMARY_ACCOUNT_OF = UUID.randomUUID();

  @Test
  void oneTableSelectsTheBoundColumnsWithTheRowLimit() {
    final Generated generated =
        OntologyConceptSqlGenerator.generate(
            concept("Funds Transfer", table(TRANSFERS, "Snowflake", "transfer_id", "amount_usd")),
            List.of());

    assertEquals(
        "SELECT \"transfer_id\", \"amount_usd\"\nFROM \"payments\".\"transfers\"\nLIMIT 50",
        generated.sql());
    assertEquals(OntologyConceptQueryDialect.SNOWFLAKE, generated.dialect());
    assertEquals("finance", generated.service());
    assertEquals("Snowflake", generated.serviceType());
    assertEquals(List.of(TRANSFERS), generated.tables());
  }

  @Test
  void aTableWithNoColumnBindingsSelectsEverything() {
    final Generated generated =
        OntologyConceptSqlGenerator.generate(
            concept("Funds Transfer", table(TRANSFERS, "Mysql")), List.of());

    assertEquals("SELECT *\nFROM `payments`.`transfers`\nLIMIT 50", generated.sql());
  }

  @Test
  void twoHopsJoinThroughForeignKeysInEitherDirection() {
    final BoundTable transfers =
        withConstraints(
            table(TRANSFERS, "Postgres", "transfer_id", "customer_id"),
            foreignKey(List.of("customer_id"), CUSTOMERS, "customer_id"));
    final BoundTable accounts =
        withConstraints(
            table(ACCOUNTS, "Postgres", "account_id", "iban"),
            foreignKey(List.of("owner_id", "owner_region"), CUSTOMERS, "customer_id", "region"));
    final Generated generated =
        OntologyConceptSqlGenerator.generate(
            concept("Funds Transfer", transfers),
            List.of(
                new Hop(
                    PART_OF,
                    null,
                    "part of",
                    concept("Customer", table(CUSTOMERS, "Postgres", "name"))),
                new Hop(PAID_BY, null, "holds", concept("Account", accounts))));

    assertEquals(
        String.join(
            "\n",
            "SELECT t2.account_id, t2.iban",
            "FROM payments.transfers t0",
            "JOIN payments.customers t1 ON t0.customer_id = t1.customer_id -- part of",
            "JOIN payments.accounts t2 ON t1.customer_id = t2.owner_id AND t1.region = t2.owner_region -- holds",
            "LIMIT 50"),
        generated.sql());
    assertEquals(List.of(TRANSFERS, CUSTOMERS, ACCOUNTS), generated.tables());
  }

  @Test
  void aHopWithoutAConstraintJoinsTheObjectPropertyColumnToTheTargetIdentifier() {
    final BoundTable transfers =
        new BoundTable(
            TRANSFERS,
            "Postgres",
            List.of(List.of("transfer_id"), List.of("payer_id")),
            Map.of(PAID_BY, List.of("payer_id")),
            List.of("transfer_id"),
            List.of());
    final BoundTable customers =
        new BoundTable(
            CUSTOMERS,
            "Postgres",
            List.of(List.of("customer_id"), List.of("name")),
            Map.of(),
            List.of("customer_id"),
            List.of());

    final Generated forward =
        OntologyConceptSqlGenerator.generate(
            concept("Funds Transfer", transfers),
            List.of(new Hop(PAID_BY, null, "paid by", concept("Customer", customers))));
    final Generated inverse =
        OntologyConceptSqlGenerator.generate(
            concept("Customer", customers),
            List.of(new Hop(PAID_BY, null, "pays", concept("Funds Transfer", transfers))));

    assertEquals(
        "SELECT t1.customer_id, t1.name\nFROM payments.transfers t0\n"
            + "JOIN payments.customers t1 ON t0.payer_id = t1.customer_id -- paid by\nLIMIT 50",
        forward.sql());
    assertEquals(
        "SELECT t1.transfer_id, t1.payer_id\nFROM payments.customers t0\n"
            + "JOIN payments.transfers t1 ON t0.customer_id = t1.payer_id -- pays\nLIMIT 50",
        inverse.sql());
  }

  @Test
  void aBindingWinsOverAForeignKeyOnAnotherColumnAndOtherServicesAreNeverJoined() {
    final BoundTable transfers =
        new BoundTable(
            TRANSFERS,
            "Postgres",
            List.of(List.of("payer_id")),
            Map.of(PAID_BY, List.of("payer_id")),
            List.of(),
            List.of(foreignKey(List.of("customer_id"), CUSTOMERS, "customer_id")));
    final BoundTable elsewhere =
        new BoundTable(
            "crm.db.payments.customers", "Postgres", List.of(), Map.of(), List.of("id"), List.of());
    final BoundTable customers =
        new BoundTable(
            CUSTOMERS, "Postgres", List.of(), Map.of(), List.of("customer_id"), List.of());

    final Generated generated =
        OntologyConceptSqlGenerator.generate(
            concept("Funds Transfer", transfers),
            List.of(
                new Hop(
                    PAID_BY,
                    null,
                    "paid\nby",
                    new BoundConcept("Customer", List.of(elsewhere, customers)))));

    assertEquals(
        "SELECT t1.*\nFROM payments.transfers t0\n"
            + "JOIN payments.customers t1 ON t0.payer_id = t1.customer_id -- paid by\nLIMIT 50",
        generated.sql());
  }

  @Test
  void aBoundHopIgnoresTheOnlyForeignKeyWhenItIsOnAnotherColumn() {
    assertEquals(
        "SELECT t1.customer_id\nFROM payments.transfers t0\n"
            + "JOIN payments.customers t1 ON t0.payee_id = t1.customer_id -- received by\nLIMIT 50",
        OntologyConceptSqlGenerator.generate(
                concept("Funds Transfer", payeeBoundTransfers()),
                List.of(
                    new Hop(
                        RECEIVED_BY,
                        null,
                        "received by",
                        concept("Customer", identifiedCustomers()))))
            .sql());
  }

  @Test
  void aBoundHopFromTheReferredTableIgnoresTheOnlyForeignKeyWhenItIsOnAnotherColumn() {
    assertEquals(
        "SELECT t1.transfer_id\nFROM payments.customers t0\n"
            + "JOIN payments.transfers t1 ON t0.customer_id = t1.payee_id -- received\nLIMIT 50",
        OntologyConceptSqlGenerator.generate(
                concept("Customer", identifiedCustomers()),
                List.of(
                    new Hop(
                        RECEIVED_BY,
                        null,
                        "received",
                        concept("Funds Transfer", payeeBoundTransfers()))))
            .sql());
  }

  @Test
  void aForeignKeyThatAgreesWithTheBindingJoinsWithoutAnIdentifier() {
    final BoundTable transfers =
        new BoundTable(
            TRANSFERS,
            "Postgres",
            List.of(List.of("transfer_id")),
            Map.of(RECEIVED_BY, List.of("payee_id")),
            List.of(),
            List.of(foreignKey(List.of("payee_id"), CUSTOMERS, "customer_id")));

    assertEquals(
        "SELECT t1.name\nFROM payments.transfers t0\n"
            + "JOIN payments.customers t1 ON t0.payee_id = t1.customer_id -- received by\nLIMIT 50",
        OntologyConceptSqlGenerator.generate(
                concept("Funds Transfer", transfers),
                List.of(
                    new Hop(
                        RECEIVED_BY,
                        null,
                        "received by",
                        concept("Customer", table(CUSTOMERS, "Postgres", "name")))))
            .sql());
  }

  @Test
  void anUnboundHopWithAForeignKeyInEachDirectionIsANamedBadRequest() {
    final BoundTable customers =
        withConstraints(
            table(CUSTOMERS, "Postgres", "customer_id"),
            foreignKey(List.of("primary_account_id"), ACCOUNTS, "account_id"));
    final BoundTable accounts =
        withConstraints(
            table(ACCOUNTS, "Postgres", "account_id"),
            foreignKey(List.of("customer_id"), CUSTOMERS, "customer_id"));

    assertEquals(
        "Hop 1 (holds): several foreign keys join "
            + CUSTOMERS
            + " and "
            + ACCOUNTS
            + "; bind the holds property to one of their columns",
        assertThrows(
                BadRequestException.class,
                () ->
                    OntologyConceptSqlGenerator.generate(
                        concept("Customer", customers),
                        List.of(new Hop(HOLDS, null, "holds", concept("Account", accounts)))))
            .getMessage());
  }

  @Test
  void aBindingPicksBetweenForeignKeysInEachDirection() {
    final BoundTable customers =
        withConstraints(
            table(CUSTOMERS, "Postgres", "customer_id"),
            foreignKey(List.of("primary_account_id"), ACCOUNTS, "account_id"));
    final BoundTable accounts =
        new BoundTable(
            ACCOUNTS,
            "Postgres",
            List.of(List.of("account_id")),
            Map.of(HOLDS, List.of("customer_id")),
            List.of(),
            List.of(foreignKey(List.of("customer_id"), CUSTOMERS, "customer_id")));

    assertEquals(
        "SELECT t1.account_id\nFROM payments.customers t0\n"
            + "JOIN payments.accounts t1 ON t0.customer_id = t1.customer_id -- holds\nLIMIT 50",
        OntologyConceptSqlGenerator.generate(
                concept("Customer", customers),
                List.of(new Hop(HOLDS, null, "holds", concept("Account", accounts))))
            .sql());
  }

  @Test
  void aBoundHopSkipsAnEarlierCandidateWhoseForeignKeyIgnoresTheBinding() {
    final BoundTable customers =
        new BoundTable(
            CUSTOMERS,
            "Postgres",
            List.of(List.of("customer_id")),
            Map.of(),
            List.of("customer_id"),
            List.of());
    final BoundTable ledger =
        withConstraints(
            table(LEDGER, "Postgres", "entry_id"),
            foreignKey(List.of("customer_id"), CUSTOMERS, "customer_id"));
    final BoundTable transfers =
        new BoundTable(
            TRANSFERS,
            "Postgres",
            List.of(List.of("transfer_id")),
            Map.of(RECEIVED_BY, List.of("payee_id")),
            List.of("transfer_id"),
            List.of());

    assertEquals(
        "SELECT t1.transfer_id\nFROM payments.customers t0\n"
            + "JOIN payments.transfers t1 ON t0.customer_id = t1.payee_id -- received\nLIMIT 50",
        OntologyConceptSqlGenerator.generate(
                concept("Customer", customers),
                List.of(
                    new Hop(
                        RECEIVED_BY,
                        null,
                        "received",
                        new BoundConcept("Funds Transfer", List.of(ledger, transfers)))))
            .sql());
  }

  @Test
  void aHopBoundOnBothTablesFollowsThePreviousTablesBinding() {
    final BoundTable customers =
        new BoundTable(
            CUSTOMERS,
            "Postgres",
            List.of(List.of("customer_id")),
            Map.of(RECEIVED_BY, List.of("favourite_transfer_id")),
            List.of("customer_id"),
            List.of(foreignKey(List.of("favourite_transfer_id"), TRANSFERS, "transfer_id")));

    assertEquals(
        "SELECT t1.customer_id\nFROM payments.transfers t0\n"
            + "JOIN payments.customers t1 ON t0.payee_id = t1.customer_id -- received by\nLIMIT 50",
        OntologyConceptSqlGenerator.generate(
                concept("Funds Transfer", payeeBoundTransfers()),
                List.of(new Hop(RECEIVED_BY, null, "received by", concept("Customer", customers))))
            .sql());
  }

  @Test
  void identifiersAreQuotedInEachDialectsStyle() {
    final String table = "finance.warehouse.\"Payments Core\".transfers";

    assertEquals(
        "SELECT \"Amount USD\", \"order\", \"transfer_id\"\nFROM \"Payments Core\".\"transfers\"\nLIMIT 50",
        sqlFor(table, "Snowflake"));
    assertEquals(
        "SELECT `Amount USD`, `order`, `transfer_id`\nFROM `Payments Core`.`transfers`\nLIMIT 50",
        sqlFor(table, "BigQuery"));
    assertEquals(
        "SELECT `Amount USD`, `order`, `transfer_id`\nFROM `Payments Core`.`transfers`\nLIMIT 50",
        sqlFor(table, "Mysql"));
    assertEquals(
        "SELECT `Amount USD`, `order`, `transfer_id`\nFROM `Payments Core`.`transfers`\nLIMIT 50",
        sqlFor(table, "Iomete"));
    assertEquals(
        "SELECT TOP 50 [Amount USD], [order], [transfer_id]\nFROM [Payments Core].[transfers]",
        sqlFor(table, "Mssql"));
    assertEquals(OntologyConceptQueryDialect.ANSI, OntologyConceptSqlGenerator.dialectOf("Trino"));
    assertEquals(
        OntologyConceptQueryDialect.SPARK, OntologyConceptSqlGenerator.dialectOf("Iomete"));
  }

  @Test
  void snowflakeQuotesEachNameExactlyAsStored() {
    assertEquals(
        "SELECT \"TRANSFER_ID\", \"AMOUNT_USD\"\nFROM \"PAYMENTS\".\"TRANSFERS\"\nLIMIT 50",
        sqlFor("FINANCE.WAREHOUSE.PAYMENTS.TRANSFERS", "Snowflake", "TRANSFER_ID", "AMOUNT_USD"));
    assertEquals(
        "SELECT \"transfer_id\", \"amount_usd\"\nFROM \"payments\".\"transfers\"\nLIMIT 50",
        sqlFor("finance.warehouse.payments.transfers", "Snowflake", "transfer_id", "amount_usd"));
  }

  @Test
  void eachDialectQuotesItsOwnReservedWords() {
    assertEquals(
        "SELECT `rank`, `index`, `groups`\nFROM `payments`.`transfers`\nLIMIT 50",
        sqlFor(TRANSFERS, "Mysql", "rank", "index", "groups"));
    assertEquals(
        "SELECT \"only\", \"fetch\", \"constraint\", \"cast\"\nFROM payments.transfers\nLIMIT 50",
        sqlFor(TRANSFERS, "Postgres", "only", "fetch", "constraint", "cast"));
    assertEquals(
        "SELECT `hash`, `qualify`, `except`, `over`\nFROM `payments`.`transfers`\nLIMIT 50",
        sqlFor(TRANSFERS, "BigQuery", "hash", "qualify", "except", "over"));
    assertEquals(
        "SELECT \"start\", \"sample\", \"qualify\", \"account\"\nFROM \"payments\".\"transfers\"\nLIMIT 50",
        sqlFor(TRANSFERS, "Snowflake", "start", "sample", "qualify", "account"));
    assertEquals(
        "SELECT TOP 50 [top], [file], [public]\nFROM [payments].[transfers]",
        sqlFor(TRANSFERS, "Mssql", "top", "file", "public"));
  }

  @Test
  void aServiceWithNoSupportedDialectIsANamedBadRequest() {
    assertEquals(
        "SQL generation does not support Oracle",
        assertThrows(BadRequestException.class, () -> sqlFor(TRANSFERS, "Oracle", "transfer_id"))
            .getMessage());
    assertEquals(
        "SQL generation does not support MongoDB",
        assertThrows(BadRequestException.class, () -> sqlFor(TRANSFERS, "MongoDB", "transfer_id"))
            .getMessage());
  }

  @Test
  void severalForeignKeysToOneTableUseTheOneTheHopPropertyIsBoundTo() {
    final BoundTable payments =
        new BoundTable(
            TRANSFERS,
            "Postgres",
            List.of(List.of("transfer_id")),
            Map.of(RECEIVED_BY, List.of("payee_id")),
            List.of("transfer_id"),
            List.of(
                foreignKey(List.of("payer_id"), CUSTOMERS, "customer_id"),
                foreignKey(List.of("payee_id"), CUSTOMERS, "customer_id")));
    final BoundTable customers = table(CUSTOMERS, "Postgres", "customer_id", "name");

    final Generated forward =
        OntologyConceptSqlGenerator.generate(
            concept("Funds Transfer", payments),
            List.of(new Hop(RECEIVED_BY, null, "received by", concept("Customer", customers))));
    final Generated inverse =
        OntologyConceptSqlGenerator.generate(
            concept("Customer", customers),
            List.of(new Hop(RECEIVED_BY, null, "received", concept("Funds Transfer", payments))));

    assertEquals(
        "SELECT t1.customer_id, t1.name\nFROM payments.transfers t0\n"
            + "JOIN payments.customers t1 ON t0.payee_id = t1.customer_id -- received by\nLIMIT 50",
        forward.sql());
    assertEquals(
        "SELECT t1.transfer_id\nFROM payments.customers t0\n"
            + "JOIN payments.transfers t1 ON t0.customer_id = t1.payee_id -- received\nLIMIT 50",
        inverse.sql());
  }

  @Test
  void severalForeignKeysToOneTableWithNoBindingAreANamedBadRequest() {
    final BoundTable payments =
        withConstraints(
            table(TRANSFERS, "Postgres", "transfer_id"),
            foreignKey(List.of("payer_id"), CUSTOMERS, "customer_id"),
            foreignKey(List.of("payee_id"), CUSTOMERS, "customer_id"));

    final BadRequestException ambiguous =
        assertThrows(
            BadRequestException.class,
            () ->
                OntologyConceptSqlGenerator.generate(
                    concept("Funds Transfer", payments),
                    List.of(
                        new Hop(
                            RECEIVED_BY,
                            null,
                            "received by",
                            concept("Customer", table(CUSTOMERS, "Postgres", "name"))))));

    assertEquals(
        "Hop 1 (received by): several foreign keys join "
            + TRANSFERS
            + " and "
            + CUSTOMERS
            + "; bind the received by property to one of their columns",
        ambiguous.getMessage());
  }

  @Test
  void anUnboundSelfRelationJoinsTheTablesOneForeignKeyToItself() {
    final BoundTable employees =
        withConstraints(
            table(EMPLOYEES, "Postgres", "employee_id"),
            foreignKey(List.of("manager_id"), EMPLOYEES, "employee_id"));
    final BoundConcept employee = concept("Employee", employees);

    assertEquals(
        "SELECT t1.employee_id\nFROM payments.employees t0\n"
            + "JOIN payments.employees t1 ON t0.manager_id = t1.employee_id -- managed by\n"
            + "LIMIT 50",
        OntologyConceptSqlGenerator.generate(
                employee, List.of(new Hop(MANAGED_BY, null, "managed by", employee)))
            .sql());
  }

  @Test
  void anUnboundHopBetweenTwoConceptsBoundToOneTableJoinsItsOneForeignKey() {
    final BoundTable employees =
        withConstraints(
            table(EMPLOYEES, "Postgres", "employee_id"),
            foreignKey(List.of("manager_id"), EMPLOYEES, "employee_id"));
    final BoundTable managers =
        withConstraints(
            table(EMPLOYEES, "Postgres", "name"),
            foreignKey(List.of("manager_id"), EMPLOYEES, "employee_id"));

    assertEquals(
        "SELECT t1.name\nFROM payments.employees t0\n"
            + "JOIN payments.employees t1 ON t0.manager_id = t1.employee_id -- managed by\n"
            + "LIMIT 50",
        OntologyConceptSqlGenerator.generate(
                concept("Employee", employees),
                List.of(new Hop(MANAGED_BY, null, "managed by", concept("Manager", managers))))
            .sql());
  }

  @Test
  void anUnboundSelfRelationOverTwoForeignKeysToItselfIsANamedBadRequest() {
    final BoundTable employees =
        withConstraints(
            table(EMPLOYEES, "Postgres", "employee_id"),
            foreignKey(List.of("manager_id"), EMPLOYEES, "employee_id"),
            foreignKey(List.of("mentor_id"), EMPLOYEES, "employee_id"));
    final BoundConcept employee = concept("Employee", employees);

    assertEquals(
        "Hop 1 (managed by): several foreign keys join "
            + EMPLOYEES
            + " and "
            + EMPLOYEES
            + "; bind the managed by property to one of their columns",
        assertThrows(
                BadRequestException.class,
                () ->
                    OntologyConceptSqlGenerator.generate(
                        employee, List.of(new Hop(MANAGED_BY, null, "managed by", employee))))
            .getMessage());
  }

  @Test
  void anUnboundSelfRelationWhoseInverseIsBoundJoinsAgainstTheKey() {
    final BoundConcept employee = concept("Employee", managerBoundEmployees());

    assertEquals(
        "SELECT t1.employee_id, t1.manager_id\nFROM payments.employees t0\n"
            + "JOIN payments.employees t1 ON t0.employee_id = t1.manager_id -- manages\n"
            + "LIMIT 50",
        OntologyConceptSqlGenerator.generate(
                employee, List.of(new Hop(MANAGES, MANAGED_BY, "manages", employee)))
            .sql());
  }

  @Test
  void aBoundSelfRelationWithADeclaredInverseJoinsAlongTheKey() {
    final BoundConcept employee = concept("Employee", managerBoundEmployees());

    assertEquals(
        "SELECT t1.employee_id, t1.manager_id\nFROM payments.employees t0\n"
            + "JOIN payments.employees t1 ON t0.manager_id = t1.employee_id -- managed by\n"
            + "LIMIT 50",
        OntologyConceptSqlGenerator.generate(
                employee, List.of(new Hop(MANAGED_BY, MANAGES, "managed by", employee)))
            .sql());
  }

  @Test
  void anUnboundHopBetweenTwoConceptsOfOneTableFollowsTheTargetsBindingOfTheInverse() {
    final BoundTable managers =
        withConstraints(
            table(EMPLOYEES, "Postgres", "name"),
            foreignKey(List.of("manager_id"), EMPLOYEES, "employee_id"));

    assertEquals(
        "SELECT t1.employee_id, t1.manager_id\nFROM payments.employees t0\n"
            + "JOIN payments.employees t1 ON t0.employee_id = t1.manager_id -- manages\n"
            + "LIMIT 50",
        OntologyConceptSqlGenerator.generate(
                concept("Manager", managers),
                List.of(
                    new Hop(
                        MANAGES,
                        MANAGED_BY,
                        "manages",
                        concept("Employee", managerBoundEmployees()))))
            .sql());
  }

  @Test
  void anUnboundSelfRelationWithAnUnboundInverseIsANamedBadRequest() {
    final BoundConcept employee =
        concept(
            "Employee",
            withConstraints(
                table(EMPLOYEES, "Postgres", "employee_id"),
                foreignKey(List.of("manager_id"), EMPLOYEES, "employee_id")));

    assertEquals(
        "Hop 1 (manages): the foreign key from manager_id to employee_id joins "
            + EMPLOYEES
            + " to itself in either direction; bind the manages property or its inverse to"
            + " manager_id",
        assertThrows(
                BadRequestException.class,
                () ->
                    OntologyConceptSqlGenerator.generate(
                        employee, List.of(new Hop(MANAGES, MANAGED_BY, "manages", employee))))
            .getMessage());
    assertEquals(
        "Hop 1 (managed by): the foreign key from manager_id to employee_id joins "
            + EMPLOYEES
            + " to itself in either direction; bind the managed by property or its inverse to"
            + " manager_id",
        assertThrows(
                BadRequestException.class,
                () ->
                    OntologyConceptSqlGenerator.generate(
                        employee, List.of(new Hop(MANAGED_BY, MANAGES, "managed by", employee))))
            .getMessage());
  }

  @Test
  void anUnboundSelfRelationThatIsItsOwnInverseJoinsAlongTheKey() {
    final BoundConcept employee =
        concept(
            "Employee",
            withConstraints(
                table(EMPLOYEES, "Postgres", "employee_id"),
                foreignKey(List.of("manager_id"), EMPLOYEES, "employee_id")));

    assertEquals(
        "SELECT t1.employee_id\nFROM payments.employees t0\n"
            + "JOIN payments.employees t1 ON t0.manager_id = t1.employee_id -- managed by\n"
            + "LIMIT 50",
        OntologyConceptSqlGenerator.generate(
                employee, List.of(new Hop(MANAGED_BY, MANAGED_BY, "managed by", employee)))
            .sql());
  }

  @Test
  void anUnboundHopWhoseInverseIsBoundPicksBetweenForeignKeysInEachDirection() {
    final BoundTable accounts =
        withConstraints(
            table(ACCOUNTS, "Postgres", "account_id"),
            foreignKey(List.of("customer_id"), CUSTOMERS, "customer_id"));
    final BoundTable customers =
        new BoundTable(
            CUSTOMERS,
            "Postgres",
            List.of(List.of("customer_id")),
            Map.of(PRIMARY_ACCOUNT, List.of("primary_account_id")),
            List.of(),
            List.of(foreignKey(List.of("primary_account_id"), ACCOUNTS, "account_id")));

    assertEquals(
        "SELECT t1.customer_id\nFROM payments.accounts t0\n"
            + "JOIN payments.customers t1 ON t0.account_id = t1.primary_account_id"
            + " -- primary account of\nLIMIT 50",
        OntologyConceptSqlGenerator.generate(
                concept("Account", accounts),
                List.of(
                    new Hop(
                        PRIMARY_ACCOUNT_OF,
                        PRIMARY_ACCOUNT,
                        "primary account of",
                        concept("Customer", customers))))
            .sql());
  }

  @Test
  void aHopNeverJoinsATableInAnotherDatabaseOfTheService() {
    final String otherDatabase = "finance.analytics.crm.customers";
    final BoundTable payments =
        withConstraints(
            table(TRANSFERS, "Snowflake", "transfer_id"),
            foreignKey(List.of("customer_id"), otherDatabase, "customer_id"));

    assertEquals(
        "Hop 1 (paid by): no foreign key or object-property binding joins "
            + TRANSFERS
            + " to a table bound to Customer",
        assertThrows(
                BadRequestException.class,
                () ->
                    OntologyConceptSqlGenerator.generate(
                        concept("Funds Transfer", payments),
                        List.of(
                            new Hop(
                                PAID_BY,
                                null,
                                "paid by",
                                concept("Customer", table(otherDatabase, "Snowflake", "name"))))))
            .getMessage());
  }

  @Test
  void aHopNeverJoinsATableOfAnotherService() {
    final BoundTable payments =
        new BoundTable(
            TRANSFERS,
            "Postgres",
            List.of(List.of("payer_id")),
            Map.of(PAID_BY, List.of("payer_id")),
            List.of(),
            List.of());
    final BoundTable elsewhere =
        new BoundTable(
            "crm.warehouse.payments.customers",
            "Postgres",
            List.of(),
            Map.of(),
            List.of("id"),
            List.of());

    assertEquals(
        "Hop 1 (paid by): no foreign key or object-property binding joins "
            + TRANSFERS
            + " to a table bound to Customer",
        assertThrows(
                BadRequestException.class,
                () ->
                    OntologyConceptSqlGenerator.generate(
                        concept("Funds Transfer", payments),
                        List.of(new Hop(PAID_BY, null, "paid by", concept("Customer", elsewhere)))))
            .getMessage());
  }

  @Test
  void aReferredColumnWithADotIsUnquotedBeforeDialectQuoting() {
    final BoundTable payments =
        withConstraints(
            table(TRANSFERS, "Postgres", "transfer_id"),
            foreignKey(List.of("customer_id"), CUSTOMERS, "\"cust.id\""));
    final BoundTable customers = table(CUSTOMERS, "Postgres", "name");

    assertEquals(
        "SELECT t1.name\nFROM payments.transfers t0\n"
            + "JOIN payments.customers t1 ON t0.customer_id = t1.\"cust.id\" -- part of\nLIMIT 50",
        OntologyConceptSqlGenerator.generate(
                concept("Funds Transfer", payments),
                List.of(new Hop(PART_OF, null, "part of", concept("Customer", customers))))
            .sql());
  }

  @Test
  void embeddedQuoteCharactersAreEscaped() {
    final BoundTable table =
        new BoundTable(
            TRANSFERS,
            "Mysql",
            List.of(List.of("a`b"), List.of("c\"d")),
            Map.of(),
            List.of(),
            List.of());
    final BoundTable ansi =
        new BoundTable(
            TRANSFERS, "Postgres", List.of(List.of("c\"d")), Map.of(), List.of(), List.of());

    assertEquals(
        "SELECT `a``b`, `c\"d`\nFROM `payments`.`transfers`\nLIMIT 50",
        OntologyConceptSqlGenerator.generate(concept("X", table), List.of()).sql());
    assertEquals(
        "SELECT \"c\"\"d\"\nFROM payments.transfers\nLIMIT 50",
        OntologyConceptSqlGenerator.generate(concept("X", ansi), List.of()).sql());
  }

  @Test
  void aMissingBindingIsANamedBadRequest() {
    final BoundConcept unbound = new BoundConcept("Funds Transfer", List.of());
    final BoundConcept transfers =
        concept("Funds Transfer", table(TRANSFERS, "Postgres", "transfer_id"));

    assertEquals(
        "Concept Funds Transfer has no bound table you can view among its first 100 table bindings",
        assertThrows(
                BadRequestException.class,
                () -> OntologyConceptSqlGenerator.generate(unbound, List.of()))
            .getMessage());
    assertEquals(
        "Hop 1 (part of) reaches concept Customer, which has no bound table you can view"
            + " among its first 100 table bindings",
        assertThrows(
                BadRequestException.class,
                () ->
                    OntologyConceptSqlGenerator.generate(
                        transfers,
                        List.of(
                            new Hop(
                                PART_OF,
                                null,
                                "part of",
                                new BoundConcept("Customer", List.of())))))
            .getMessage());
    assertEquals(
        "Hop 1 (part of): no foreign key or object-property binding joins "
            + TRANSFERS
            + " to a table bound to Customer",
        assertThrows(
                BadRequestException.class,
                () ->
                    OntologyConceptSqlGenerator.generate(
                        transfers,
                        List.of(
                            new Hop(
                                PART_OF,
                                null,
                                "part of",
                                concept("Customer", table(CUSTOMERS, "Postgres", "name"))))))
            .getMessage());
  }

  private static String sqlFor(final String table, final String serviceType) {
    return sqlFor(table, serviceType, "Amount USD", "order", "transfer_id");
  }

  private static String sqlFor(
      final String table, final String serviceType, final String... columns) {
    return OntologyConceptSqlGenerator.generate(
            concept("Funds Transfer", table(table, serviceType, columns)), List.of())
        .sql();
  }

  private static BoundTable payeeBoundTransfers() {
    return new BoundTable(
        TRANSFERS,
        "Postgres",
        List.of(List.of("transfer_id")),
        Map.of(RECEIVED_BY, List.of("payee_id")),
        List.of("transfer_id"),
        List.of(foreignKey(List.of("payer_id"), CUSTOMERS, "customer_id")));
  }

  private static BoundTable managerBoundEmployees() {
    return new BoundTable(
        EMPLOYEES,
        "Postgres",
        List.of(List.of("employee_id"), List.of("manager_id")),
        Map.of(MANAGED_BY, List.of("manager_id")),
        List.of(),
        List.of(foreignKey(List.of("manager_id"), EMPLOYEES, "employee_id")));
  }

  private static BoundTable identifiedCustomers() {
    return new BoundTable(
        CUSTOMERS,
        "Postgres",
        List.of(List.of("customer_id")),
        Map.of(),
        List.of("customer_id"),
        List.of());
  }

  private static BoundConcept concept(final String label, final BoundTable table) {
    return new BoundConcept(label, List.of(table));
  }

  private static BoundTable table(
      final String fqn, final String serviceType, final String... columns) {
    return new BoundTable(
        fqn,
        serviceType,
        List.of(columns).stream().map(List::of).toList(),
        Map.of(),
        List.of(),
        List.of());
  }

  private static BoundTable withConstraints(
      final BoundTable table, final TableConstraint... constraints) {
    return new BoundTable(
        table.fullyQualifiedName(),
        table.serviceType(),
        table.columns(),
        table.objectColumns(),
        table.identifier(),
        List.of(constraints));
  }

  private static TableConstraint foreignKey(
      final List<String> columns, final String referredTable, final String... referred) {
    return new TableConstraint()
        .withConstraintType(TableConstraint.ConstraintType.FOREIGN_KEY)
        .withColumns(columns)
        .withReferredColumns(
            List.of(referred).stream().map(column -> referredTable + "." + column).toList());
  }
}
