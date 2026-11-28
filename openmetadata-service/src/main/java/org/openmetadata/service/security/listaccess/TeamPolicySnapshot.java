package org.openmetadata.service.security.listaccess;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.security.policyevaluator.CompiledRule;
import org.openmetadata.service.security.policyevaluator.SubjectCache;
import org.openmetadata.service.util.EntityUtil.Fields;

/**
 * The team graph and team policies as of one policy generation: the deny rules each team's own
 * policies bring to the rows it owns, and the teams under a team. A team, role or policy change
 * starts a new generation, and the snapshot also expires with the compiled policies, so a change made
 * on another server is seen within the same bound.
 */
@Slf4j
final class TeamPolicySnapshot implements TeamTree {
  private static final int POLICY_PAGE_SIZE = 100;
  private static final int MAX_GENERATIONS = 4;
  private static final int MAX_SUBTREES = 256;
  // A larger subtree is approximated, and each row it reaches is checked after the query.
  static final int MAX_SUBTREE_TEAMS = 1000;

  private static final Cache<Long, TeamPolicySnapshot> SNAPSHOTS =
      Caffeine.newBuilder()
          .maximumSize(MAX_GENERATIONS)
          .expireAfterWrite(SubjectCache.POLICIES_TTL)
          .build();

  private final List<TeamDenies> denies;
  private final Cache<UUID, TeamSubtree> subtrees =
      Caffeine.newBuilder().maximumSize(MAX_SUBTREES).build();

  private TeamPolicySnapshot(List<TeamDenies> denies) {
    this.denies = List.copyOf(denies);
  }

  static TeamPolicySnapshot current() {
    return SNAPSHOTS.get(SubjectCache.policyGeneration(), ignored -> load());
  }

  List<TeamDenies> denies() {
    return denies;
  }

  @Override
  public TeamSubtree subtreeOf(String teamName) {
    TeamSubtree subtree = new TeamSubtree(Set.of(), true);
    if (Entity.ORGANIZATION_NAME.equals(teamName)) {
      subtree = TeamSubtree.tooLarge();
    } else {
      UUID teamId = liveTeamId(teamName);
      if (teamId != null) {
        subtree = subtreeOf(teamId);
      }
    }
    return subtree;
  }

  /**
   * The team and every live team under it, walked down the edges {@code TeamHierarchyResolver} walks
   * up. A deleted team ends its branch there too. Every team without a live parent sits under the
   * Organization, so its subtree is never listed. Callers pass a live team: the name overload
   * resolves only live teams, and {@link #denies()} holds only live teams.
   */
  @Override
  public TeamSubtree subtreeOf(UUID teamId) {
    return subtrees.get(teamId, TeamPolicySnapshot::walkDown);
  }

  private static TeamSubtree walkDown(UUID teamId) {
    Set<UUID> teams = new HashSet<>(Set.of(teamId));
    Set<UUID> level = Set.of(teamId);
    boolean complete = !isOrganization(teamId);
    while (complete && !level.isEmpty()) {
      level = liveChildren(level, teams);
      teams.addAll(level);
      complete = teams.size() <= MAX_SUBTREE_TEAMS;
    }
    return complete ? new TeamSubtree(teams, true) : TeamSubtree.tooLarge();
  }

  private static Set<UUID> liveChildren(Set<UUID> parents, Set<UUID> seen) {
    List<String> parentIds = parents.stream().map(UUID::toString).toList();
    List<UUID> children =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .findToBatch(parentIds, Relationship.PARENT_OF.ordinal(), Entity.TEAM, Entity.TEAM)
            .stream()
            .map(edge -> UUID.fromString(edge.getToId()))
            .filter(child -> !seen.contains(child))
            .distinct()
            .toList();
    return children.isEmpty() ? Set.of() : liveTeams(children);
  }

  private static Set<UUID> liveTeams(List<UUID> teamIds) {
    Set<UUID> live = new HashSet<>();
    for (EntityReference team :
        Entity.getEntityReferencesByIds(Entity.TEAM, teamIds, Include.ALL)) {
      if (!Boolean.TRUE.equals(team.getDeleted())) {
        live.add(team.getId());
      }
    }
    return live;
  }

  private static boolean isOrganization(UUID teamId) {
    UUID organizationId = liveTeamId(Entity.ORGANIZATION_NAME);
    return teamId.equals(organizationId);
  }

  private static UUID liveTeamId(String teamName) {
    UUID teamId = null;
    try {
      teamId = Entity.getEntityReferenceByName(Entity.TEAM, teamName, Include.NON_DELETED).getId();
    } catch (EntityNotFoundException e) {
      LOG.debug("Team {} no longer exists, so it reaches no row", teamName, e);
    }
    return teamId;
  }

  /**
   * The deny rules of every policy attached to a live team, grouped by the team. A policy lists its
   * deleted teams too, and the read path never resolves a deleted team as an owner or a parent, so
   * its rules reach no row.
   */
  private static TeamPolicySnapshot load() {
    Map<UUID, TeamDenies> byTeam = new LinkedHashMap<>();
    for (Policy policy : teamPolicies()) {
      List<CompiledRule> denyRules =
          CompiledRule.enforcedRules(policy).stream()
              .filter(rule -> rule.getEffect() == Rule.Effect.DENY)
              .toList();
      if (!denyRules.isEmpty()) {
        policy.getTeams().stream()
            .filter(team -> !Boolean.TRUE.equals(team.getDeleted()))
            .forEach(team -> addDenies(byTeam, team, denyRules));
      }
    }
    return new TeamPolicySnapshot(new ArrayList<>(byTeam.values()));
  }

  private static void addDenies(
      Map<UUID, TeamDenies> byTeam, EntityReference team, List<CompiledRule> denyRules) {
    byTeam.merge(
        team.getId(),
        new TeamDenies(team.getId(), team.getName(), denyRules),
        (held, added) -> {
          List<CompiledRule> rules = new ArrayList<>(held.denyRules());
          rules.addAll(added.denyRules());
          return new TeamDenies(held.teamId(), held.teamName(), rules);
        });
  }

  private static List<Policy> teamPolicies() {
    @SuppressWarnings("unchecked")
    EntityRepository<Policy> repository =
        (EntityRepository<Policy>) Entity.getEntityRepository(Entity.POLICY);
    Fields teams = repository.getFields("teams");
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    List<Policy> attached = new ArrayList<>();
    String after = null;
    do {
      ResultList<Policy> page = repository.listAfter(null, teams, filter, POLICY_PAGE_SIZE, after);
      page.getData().stream()
          .filter(policy -> !nullOrEmpty(policy.getTeams()))
          .forEach(attached::add);
      after = page.getPaging() == null ? null : page.getPaging().getAfter();
    } while (after != null);
    return attached;
  }
}
