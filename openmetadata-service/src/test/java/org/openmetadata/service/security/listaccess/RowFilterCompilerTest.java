package org.openmetadata.service.security.listaccess;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.listaccess.RowPredicate.Approx;
import org.openmetadata.service.security.listaccess.RowPredicate.ApproxReason;
import org.openmetadata.service.security.listaccess.RowPredicate.InDomains;
import org.openmetadata.service.security.listaccess.RowPredicate.NoDomain;
import org.openmetadata.service.security.listaccess.RowPredicate.Not;
import org.openmetadata.service.security.listaccess.RowPredicate.Or;
import org.openmetadata.service.security.listaccess.RowPredicate.OwnedBy;
import org.openmetadata.service.security.listaccess.RowPredicate.OwnerTeamWithin;
import org.openmetadata.service.security.listaccess.RowPredicate.OwnerUnderTeams;
import org.openmetadata.service.security.listaccess.RowPredicate.ReviewedBy;
import org.openmetadata.service.security.listaccess.TeamTree.TeamSubtree;
import org.openmetadata.service.security.listaccess.ValueSource.Absent;
import org.openmetadata.service.security.listaccess.ValueSource.Inherited;
import org.openmetadata.service.security.listaccess.ValueSource.Own;
import org.openmetadata.service.security.policyevaluator.CompiledRule;

/**
 * The plan for a table listing, compiled from policies shaped like the seeded ones. Each expected
 * plan is the condition a row must meet to pass {@code authorize}.
 */
class RowFilterCompilerTest {
  private static final UUID USER = UUID.fromString("00000000-0000-0000-0000-000000000001");
  private static final UUID TEAM = UUID.fromString("00000000-0000-0000-0000-000000000002");
  private static final UUID CHILD_TEAM = UUID.fromString("00000000-0000-0000-0000-000000000003");
  private static final UUID OWNING_TEAM = UUID.fromString("00000000-0000-0000-0000-000000000004");
  private static final String TEAM_NAME = "engineering";
  private static final String DOMAIN = "Finance";
  private static final List<MetadataOperation> VIEW = List.of(MetadataOperation.VIEW_BASIC);

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

  private static final ReviewedBy REVIEWER = new ReviewedBy(Set.of(USER));
  private static final CompiledRule VIEW_ALL = allow("viewAll", null);

  /** A member of one team, under no other, with one domain. */
  private record Member(boolean isAdmin, List<PolicyRules> policies) implements Caller {
    @Override
    public UUID userId() {
      return USER;
    }

    @Override
    public Set<UUID> selfAndDirectTeams() {
      return Set.of(USER, TEAM);
    }

    @Override
    public Set<String> domainFqns() {
      return Set.of(DOMAIN);
    }

    @Override
    public boolean isUnderTeam(String teamName) {
      return TEAM_NAME.equals(teamName);
    }

    @Override
    public boolean hasAnyRole(String roleName) {
      return false;
    }

    @Override
    public String impersonatedBy() {
      return null;
    }

    @Override
    public Set<UUID> visitedTeams() {
      return Set.of(TEAM);
    }
  }

  private static final TeamTree TEAMS =
      new TeamTree() {
        @Override
        public TeamSubtree subtreeOf(String teamName) {
          return TEAM_NAME.equals(teamName)
              ? new TeamSubtree(Set.of(TEAM, CHILD_TEAM), true)
              : new TeamSubtree(Set.of(), true);
        }

        @Override
        public TeamSubtree subtreeOf(UUID teamId) {
          return new TeamSubtree(Set.of(teamId), true);
        }
      };

  @Test
  void anAdminReadsEveryRow() {
    assertEquals(RowFilter.ALL_ROWS, compile(new Member(true, List.of()), List.of()));
  }

  @Test
  void anUnconditionalViewReadsEveryRow() {
    assertEquals(RowFilter.ALL_ROWS, compile(member(VIEW_ALL), List.of()));
  }

  @Test
  void aCallerNoRuleAllowsIsRefusedEveryRow() {
    CompiledRule glossaryOnly =
        new CompiledRule(
            new Rule()
                .withName("glossaryOnly")
                .withEffect(Rule.Effect.ALLOW)
                .withResources(List.of(Entity.GLOSSARY))
                .withOperations(List.of(MetadataOperation.VIEW_ALL)));

    RowFilter rows = compile(member(glossaryOnly), List.of());

    assertEquals(RowFilter.NO_ROWS, rows);
  }

  @Test
  void aDenyOutsideOwnershipLeavesTheRowsTheCallerOrTheirTeamOwns() {
    RowFilter rows = compile(member(VIEW_ALL, deny("notOwner", "!isOwner()")), List.of());

    assertEquals(where(REVIEWER, new OwnedBy(Set.of(USER, TEAM))), rows);
    assertTrue(rows.exact());
  }

  @Test
  void aDomainDenyLeavesRowsWithoutADomainOrInsideTheCallersDomains() {
    RowFilter rows = compile(member(VIEW_ALL, deny("domainOnly", "!hasDomain()")), List.of());

    assertEquals(where(REVIEWER, new NoDomain(), new InDomains(Set.of(DOMAIN))), rows);
    assertTrue(rows.exact());
  }

  @Test
  void aTeamOnlyRuleLeavesRowsOwnedUnderTheTeamItCameThrough() {
    PolicyRules teamOnly =
        new PolicyRules(Entity.TEAM, TEAM_NAME, List.of(deny("teamOnly", "!matchTeam()")));
    Caller caller =
        new Member(false, List.of(new PolicyRules(Entity.USER, "u", List.of(VIEW_ALL)), teamOnly));

    RowFilter rows = compile(caller, List.of());

    assertEquals(where(REVIEWER, new OwnerUnderTeams(Set.of(TEAM, CHILD_TEAM))), rows);
  }

  @Test
  void anOwningTeamsDenyHidesItsRowsFromCallersOutsideIt() {
    TeamDenies owning = new TeamDenies(OWNING_TEAM, "sales", List.of(deny("salesOnly", null)));

    RowFilter rows = compile(member(VIEW_ALL), List.of(owning));

    assertEquals(where(REVIEWER, new Not(new OwnerTeamWithin(Set.of(OWNING_TEAM)))), rows);
  }

  @Test
  void aTeamTheCallerBelongsToBringsNoOwningTeamDeny() {
    TeamDenies ownTeam = new TeamDenies(TEAM, TEAM_NAME, List.of(deny("teamDeny", null)));

    assertEquals(RowFilter.ALL_ROWS, compile(member(VIEW_ALL), List.of(ownTeam)));
  }

  @Test
  void aTagConditionLeavesThePlanInexactSoRowsAreCheckedAfterTheQuery() {
    RowFilter rows =
        compile(member(VIEW_ALL, deny("secret", "matchAnyTag('PII.Sensitive')")), List.of());

    assertEquals(where(REVIEWER, new Not(RowPredicate.unknown(ApproxReason.TAGS))), rows);
    assertFalse(rows.exact());
  }

  @Test
  void aFunctionWithoutATranslationLeavesThePlanInexact() {
    RowFilter rows =
        compile(
            member(VIEW_ALL, deny("certified", "!matchAnyCertification('Certification.Gold')")),
            List.of());

    assertEquals(
        where(
            REVIEWER,
            new Approx(RowPredicate.FALSE, RowPredicate.TRUE, ApproxReason.UNTRANSLATED_CONDITION)),
        rows);
    assertFalse(rows.exact());
  }

  @Test
  void reviewerAccessNeverReachesATypeThatNeedsTheEditRight() {
    RowStorage concepts =
        new RowStorage(
            Entity.ONTOLOGY_CONCEPT,
            "ontology_concept_entity",
            "fqnHash",
            new Own(),
            new Own(),
            new Own(),
            false);
    RowFilterCompiler compiler =
        new RowFilterCompiler(member(VIEW_ALL, deny("notOwner", "!isOwner()")), TEAMS, List.of());

    RowFilter rows = compiler.compile(new ListTarget(Entity.ONTOLOGY_CONCEPT, VIEW, concepts));

    assertEquals(new RowFilter.Where(new OwnedBy(Set.of(USER, TEAM))), rows);
  }

  private static RowFilter compile(Caller caller, List<TeamDenies> teamDenies) {
    return new RowFilterCompiler(caller, TEAMS, teamDenies)
        .compile(new ListTarget(Entity.TABLE, VIEW, TABLE));
  }

  private static RowFilter where(RowPredicate... any) {
    return new RowFilter.Where(new Or(List.of(any)));
  }

  private static Caller member(CompiledRule... rules) {
    return new Member(false, List.of(new PolicyRules(Entity.USER, "u", List.of(rules))));
  }

  private static CompiledRule allow(String name, String condition) {
    return rule(name, Rule.Effect.ALLOW, MetadataOperation.VIEW_ALL, condition);
  }

  private static CompiledRule deny(String name, String condition) {
    return rule(name, Rule.Effect.DENY, MetadataOperation.VIEW_ALL, condition);
  }

  private static CompiledRule rule(
      String name, Rule.Effect effect, MetadataOperation operation, String condition) {
    return new CompiledRule(
        new Rule()
            .withName(name)
            .withEffect(effect)
            .withResources(List.of("All"))
            .withOperations(List.of(operation))
            .withCondition(condition));
  }
}
