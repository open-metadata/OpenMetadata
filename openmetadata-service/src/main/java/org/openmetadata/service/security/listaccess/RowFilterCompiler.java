package org.openmetadata.service.security.listaccess;

import static org.openmetadata.service.security.listaccess.RowPredicate.ApproxReason.TEAM_SET_TOO_LARGE;
import static org.openmetadata.service.security.listaccess.RowPredicate.FALSE;
import static org.openmetadata.service.security.listaccess.RowPredicate.unknown;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.listaccess.TeamTree.TeamSubtree;
import org.openmetadata.service.security.policyevaluator.CompiledRule;

/**
 * Compiles the caller's policies into the rows of one listed type they may read. A row is decided
 * as {@code authorize} decides one entity: an admin reads every row, a reviewer of the row reads it
 * (DefaultAuthorizer.authorizeSubject), and otherwise no own deny rule and no deny rule of an
 * owning team may fire, and every requested operation needs an allow rule whose condition holds
 * (PolicyEvaluator.hasPermission).
 */
public final class RowFilterCompiler {
  private final Caller caller;
  private final TeamTree teams;
  private final List<TeamDenies> teamDenies;

  public RowFilterCompiler(Caller caller, TeamTree teams, List<TeamDenies> teamDenies) {
    this.caller = caller;
    this.teams = teams;
    this.teamDenies = List.copyOf(teamDenies);
  }

  /**
   * NoRows when the caller's policies allow no row, which is when a listing is refused. Reviewer
   * access alone does not open a listing, as it never did at the listing's entry check.
   */
  public RowFilter compile(ListTarget target) {
    return caller.isAdmin() ? RowFilter.ALL_ROWS : RowFilter.of(readableRows(target));
  }

  private RowPredicate readableRows(ListTarget target) {
    ConditionTranslator translator = new ConditionTranslator(caller, teams, target.listedType());
    RowPredicate byPolicy = RowCoverage.bound(policyDecision(target, translator), target.storage());
    return FALSE.equals(byPolicy)
        ? FALSE
        : RowPredicate.or(RowCoverage.bound(reviewerAccess(target), target.storage()), byPolicy);
  }

  private RowPredicate policyDecision(ListTarget target, ConditionTranslator translator) {
    return RowPredicate.and(
        RowPredicate.not(ownDenies(target, translator)),
        RowPredicate.not(owningTeamDenies(target, translator)),
        everyOperationAllowed(target, translator));
  }

  private RowPredicate ownDenies(ListTarget target, ConditionTranslator translator) {
    return RowPredicate.or(
        caller.policies().stream()
            .flatMap(
                policy ->
                    policy.rules().stream()
                        .filter(rule -> deniesAnyOperation(rule, target))
                        .map(rule -> translator.translate(rule, policy)))
            .toList());
  }

  /**
   * A team that owns a row brings the deny rules of its own policies and of the policies of every
   * team above it, unless the caller already holds them (SubjectContext.getPolicies).
   */
  private RowPredicate owningTeamDenies(ListTarget target, ConditionTranslator translator) {
    Set<UUID> visited = caller.visitedTeams();
    return RowPredicate.or(
        teamDenies.stream()
            .filter(team -> !visited.contains(team.teamId()))
            .map(team -> owningTeamDeny(team, target, translator))
            .toList());
  }

  private RowPredicate owningTeamDeny(
      TeamDenies team, ListTarget target, ConditionTranslator translator) {
    PolicyRules policy = new PolicyRules(Entity.TEAM, team.teamName(), team.denyRules());
    RowPredicate fires =
        RowPredicate.or(
            team.denyRules().stream()
                .filter(rule -> deniesAnyOperation(rule, target))
                .map(rule -> translator.translate(rule, policy))
                .toList());
    return FALSE.equals(fires)
        ? FALSE
        : RowPredicate.and(ownedByTeamsUnder(teams.subtreeOf(team.teamId())), fires);
  }

  private static RowPredicate ownedByTeamsUnder(TeamSubtree subtree) {
    return subtree.complete()
        ? RowPredicate.ownerTeamWithin(subtree.teams())
        : unknown(TEAM_SET_TOO_LARGE);
  }

  private RowPredicate everyOperationAllowed(ListTarget target, ConditionTranslator translator) {
    return RowPredicate.and(
        target.operations().stream()
            .map(operation -> allowed(operation, target, translator))
            .toList());
  }

  private RowPredicate allowed(
      MetadataOperation operation, ListTarget target, ConditionTranslator translator) {
    return RowPredicate.or(
        caller.policies().stream()
            .flatMap(
                policy ->
                    policy.rules().stream()
                        .filter(
                            rule ->
                                rule.getEffect() == Rule.Effect.ALLOW
                                    && rule.appliesTo(target.listedType(), operation))
                        .map(rule -> translator.translate(rule, policy)))
            .toList());
  }

  private static boolean deniesAnyOperation(CompiledRule rule, ListTarget target) {
    return rule.getEffect() == Rule.Effect.DENY
        && target.operations().stream()
            .anyMatch(operation -> rule.appliesTo(target.listedType(), operation));
  }

  /** A reviewer is matched by user id, never through a team, and not on edit-right types. */
  private RowPredicate reviewerAccess(ListTarget target) {
    return DefaultAuthorizer.EDIT_RIGHT_REQUIRED_RESOURCES.contains(target.listedType())
        ? FALSE
        : RowPredicate.reviewedBy(Set.of(caller.userId()));
  }
}
