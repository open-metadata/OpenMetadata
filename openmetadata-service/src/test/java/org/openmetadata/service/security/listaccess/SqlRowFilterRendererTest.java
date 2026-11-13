package org.openmetadata.service.security.listaccess;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.listaccess.RowPredicate.ApproxReason;
import org.openmetadata.service.security.listaccess.RowPredicate.InDomains;
import org.openmetadata.service.security.listaccess.RowPredicate.NoDomain;
import org.openmetadata.service.security.listaccess.RowPredicate.Not;
import org.openmetadata.service.security.listaccess.RowPredicate.OwnedBy;
import org.openmetadata.service.security.listaccess.RowPredicate.OwnerUnderTeams;
import org.openmetadata.service.security.listaccess.ValueSource.Absent;
import org.openmetadata.service.security.listaccess.ValueSource.Inherited;
import org.openmetadata.service.security.listaccess.ValueSource.Own;
import org.openmetadata.service.security.listaccess.ValueSource.Self;
import org.openmetadata.service.security.listaccess.ValueSource.Uncovered;

/** The WHERE fragment each condition becomes on the table that stores the listed rows. */
class SqlRowFilterRendererTest {
  private static final UUID USER = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private static final List<MetadataOperation> VIEW = List.of(MetadataOperation.VIEW_BASIC);
  // md5("Finance"), the fqnHash of a top-level domain named Finance.
  private static final String FINANCE_HASH = "c482980d384a9d0e7bc39e1140270870";

  private static final RowStorage GLOSSARY =
      new RowStorage(
          Entity.GLOSSARY, "glossary_entity", "nameHash", new Own(), new Own(), new Own(), true);
  private static final RowStorage SCHEMA =
      new RowStorage(
          Entity.DATABASE_SCHEMA,
          "database_schema_entity",
          "fqnHash",
          new Own(),
          new Own(),
          new Absent(),
          true);
  private static final RowStorage TABLE =
      new RowStorage(
          Entity.TABLE,
          "table_entity",
          "fqnHash",
          new Inherited(SCHEMA, 3),
          new Inherited(SCHEMA, 3),
          new Own(),
          true);
  private static final RowStorage USERS =
      new RowStorage(
          Entity.USER, "user_entity", "nameHash", new Self(), new Uncovered(), new Absent(), false);
  private static final RowStorage DOMAINS =
      new RowStorage(
          Entity.DOMAIN,
          "domain_entity",
          "fqnHash",
          new Uncovered(),
          new Self(),
          new Absent(),
          true);

  @Test
  void anOwnerCountsOnlyWhileTheUserOrTeamIsNotDeleted() {
    assertEquals(
        "(EXISTS (SELECT 1 FROM entity_relationship la1 WHERE la1.toId = glossary_entity.id"
            + " AND la1.toEntity = 'glossary' AND la1.relation = 8 AND la1.deleted = FALSE"
            + " AND ((la1.fromEntity = 'user' AND EXISTS (SELECT 1 FROM user_entity la2"
            + " WHERE la2.id = la1.fromId AND la2.deleted = FALSE))"
            + " OR (la1.fromEntity = 'team' AND EXISTS (SELECT 1 FROM team_entity la3"
            + " WHERE la3.id = la1.fromId AND la3.deleted = FALSE)))"
            + " AND la1.fromId IN ('00000000-0000-0000-0000-000000000001')))",
        sql(new OwnedBy(Set.of(USER)), GLOSSARY, "glossary_entity"));
  }

  @Test
  void aRowWithoutItsOwnDomainTakesTheDomainOfTheSchemaItsHashNames() {
    assertEquals(
        "((NOT EXISTS (SELECT 1 FROM entity_relationship la1 WHERE la1.toId = table_entity.id"
            + " AND la1.toEntity = 'table' AND la1.relation = 10 AND la1.deleted = FALSE"
            + " AND la1.fromEntity = 'domain')"
            + " AND EXISTS (SELECT 1 FROM database_schema_entity la2"
            + " WHERE la2.fqnHash = LEFT(table_entity.fqnHash, 98)"
            + " AND NOT EXISTS (SELECT 1 FROM entity_relationship la3 WHERE la3.toId = la2.id"
            + " AND la3.toEntity = 'databaseSchema' AND la3.relation = 10"
            + " AND la3.deleted = FALSE AND la3.fromEntity = 'domain'))))",
        sql(new NoDomain(), TABLE, "table_entity"));
  }

  @Test
  void aDomainListsItselfAndEverySubDomainUnderTheCallersDomain() {
    assertEquals(
        "((domain_entity.fqnHash = '"
            + FINANCE_HASH
            + "' OR domain_entity.fqnHash LIKE '"
            + FINANCE_HASH
            + ".%'))",
        sql(new InDomains(Set.of("Finance")), DOMAINS, "domain_entity"));
  }

  @Test
  void aUserIsItsOwnOwner() {
    assertEquals(
        "(ue.id IN ('00000000-0000-0000-0000-000000000001'))",
        sql(new OwnedBy(Set.of(USER)), USERS, "ue"));
  }

  @Test
  void aUserRowIsUnderATeamOnlyWhileTheUserIsLive() {
    UUID team = UUID.fromString("00000000-0000-0000-0000-000000000002");

    assertEquals(
        "(ue.id IN (SELECT la1.toId FROM entity_relationship la1"
            + " WHERE la1.fromId IN ('00000000-0000-0000-0000-000000000002')"
            + " AND la1.fromEntity = 'team' AND la1.toEntity = 'user' AND la1.relation = 10"
            + " AND la1.deleted = FALSE AND EXISTS (SELECT 1 FROM user_entity la2"
            + " WHERE la2.id = la1.toId AND la2.deleted = FALSE)))",
        sql(new OwnerUnderTeams(Set.of(team)), USERS, "ue"));
  }

  @Test
  void anApproximationRendersTheBoundThatKeepsEveryReadableRow() {
    RowPredicate unknownTags = RowPredicate.unknown(ApproxReason.TAGS);

    assertEquals("(TRUE)", sql(unknownTags, TABLE, "table_entity"));
    assertEquals("(NOT (FALSE))", sql(new Not(unknownTags), TABLE, "table_entity"));
  }

  @Test
  void aConditionOnRowsRefusesAQueryThatDoesNotNameItsTable() {
    CallerScope scope = CallerScope.compiled(TABLE, RowFilter.of(new NoDomain()), VIEW);

    assertThrows(IllegalStateException.class, () -> scope.sqlCondition(null));
  }

  private static String sql(RowPredicate predicate, RowStorage storage, String qualifier) {
    return CallerScope.compiled(storage, new RowFilter.Where(predicate), VIEW)
        .sqlCondition(qualifier);
  }
}
