/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.security.policyevaluator;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

/** Subject context used for Access Control Policies */
@Slf4j
public class SubjectContext {
  @Getter protected final User user;

  protected SubjectContext(User user) {
    this.user = user;
  }

  public boolean isAdmin() {
    return Boolean.TRUE.equals(user.getIsAdmin());
  }

  public boolean isBot() {
    return Boolean.TRUE.equals(user.getIsBot());
  }

  public boolean isOwner(EntityReference owner) {
    if (owner == null) {
      return false;
    }
    if (owner.getType().equals(Entity.USER) && owner.getName().equals(user.getName())) {
      return true; // Owner is same as user.
    }
    if (owner.getType().equals(Entity.TEAM)) {
      for (EntityReference userTeam : user.getTeams()) {
        if (userTeam.getName().equals(owner.getName())) {
          return true; // Owner is a team, and the user is part of this team.
        }
      }
    }
    return false;
  }

  /** Returns true if the user of this SubjectContext is under the team hierarchy of parentTeam */
  public boolean isUserUnderTeam(String parentTeam) {
    return isInTeam(parentTeam, user.getTeams());
  }

  /** Returns true if the given resource owner is under the team hierarchy of parentTeam */
  public boolean isTeamAsset(String parentTeam, EntityReference owner) {
    if (owner.getType().equals(Entity.USER)) {
      SubjectContext subjectContext = SubjectCache.getInstance().getSubjectContext(owner.getName());
      return subjectContext.isUserUnderTeam(parentTeam);
    } else if (owner.getType().equals(Entity.TEAM)) {
      Team team = SubjectCache.getInstance().getTeam(owner.getId());
      return isInTeam(parentTeam, List.of(team.getEntityReference()));
    }
    return false;
  }

  /** Return true if given list of teams is part of the hierarchy of parentTeam */
  private boolean isInTeam(String parentTeam, List<EntityReference> teams) {
    return SubjectCache.getInstance().isInTeam(parentTeam, teams);
  }

  // Iterate over all the policies of the team hierarchy the user belongs to
  public Iterator<PolicyContext> getPolicies() {
    return new UserPolicyIterator(user, new ArrayList<>());
  }

  // Iterate over all the policies of the team hierarchy the resource belongs to
  public Iterator<PolicyContext> getResourcePolicies(EntityReference owner) {
    if (owner.getType().equals(Entity.USER)) {
      SubjectContext subjectContext = SubjectCache.getInstance().getSubjectContext(owner.getName());
      return subjectContext.getPolicies();
    } else if (owner.getType().equals(Entity.TEAM)) {
      Team team = SubjectCache.getInstance().getTeam(owner.getId());
      List<UUID> teamsVisited = new ArrayList<>();
      return new TeamPolicyIterator(team.getId(), teamsVisited);
    }
    return Collections.emptyIterator();
  }

  public List<EntityReference> getTeams() {
    return user.getTeams();
  }

  @Getter
  static class PolicyContext {
    private final String entityType;
    private final String entityName;
    private final String roleName;
    private final String policyName;
    private final List<CompiledRule> rules;

    PolicyContext(String entityType, String entityName, String role, String policy, List<CompiledRule> rules) {
      this.entityType = entityType;
      this.entityName = entityName;
      this.roleName = role;
      this.policyName = policy;
      this.rules = rules;
    }
  }

  /** PolicyIterator goes over policies in a set of policies one by one. */
  static class PolicyIterator implements Iterator<PolicyContext> {

    // When executing roles from a policy, entity type User or Team to which the Role is attached to.
    // In case of executing a policy attached to a team, the entityType is Team
    private final String entityType;

    // User or Team name to which the Role or Policy is attached to

    private final String entityName;

    // Name of the role from which the policy is from. If policy is not part of the role, but from directly attaching
    // it to a Team, then null
    private final String roleName;

    // Index to the current policy being evaluation
    private int policyIndex = 0;

    // List of policies to execute
    private final List<EntityReference> policies;

    PolicyIterator(String entityType, String entityName, String roleName, List<EntityReference> policies) {
      this.entityType = entityType;
      this.entityName = entityName;
      this.roleName = roleName;
      this.policies = listOrEmpty(policies);
    }

    @Override
    public boolean hasNext() {
      if (policyIndex >= policies.size()) {
        LOG.debug(
            "iteration over policy attached to entity {}:{} role {} is completed", entityType, entityName, roleName);
      }
      return policyIndex < policies.size();
    }

    @Override
    public PolicyContext next() {
      if (!hasNext()) {
        throw new NoSuchElementException();
      }
      EntityReference policy = policies.get(policyIndex++);
      return new PolicyContext(
          entityType, entityName, roleName, policy.getName(), PolicyCache.getInstance().getPolicyRules(policy.getId()));
    }
  }

  /** RolePolicyIterator goes over policies in a set of roles one by one. */
  static class RolePolicyIterator implements Iterator<PolicyContext> {
    // Either User or Team to which the policies from a Role are attached to
    private final String entityType;
    // Either User or Team name to which the policies from a Role are attached to
    private final String entityName;
    // Index in the iterator points to the current policy being evaluated
    private int iteratorIndex = 0;
    // List of policies from the role to evaluate
    private final List<PolicyIterator> policyIterators = new ArrayList<>();

    RolePolicyIterator(String entityType, String entityName, List<EntityReference> roles) {
      this.entityType = entityType;
      this.entityName = entityName;
      for (EntityReference role : listOrEmpty(roles)) {
        policyIterators.add(
            new PolicyIterator(
                entityType, entityName, role.getName(), RoleCache.getInstance().getRole(role.getId()).getPolicies()));
      }
    }

    @Override
    public boolean hasNext() {
      while (iteratorIndex < policyIterators.size()) {
        if (policyIterators.get(iteratorIndex).hasNext()) {
          return true;
        }
        iteratorIndex++;
      }
      LOG.debug("iteration over roles attached to entity {}:{} is completed", entityType, entityName);
      return false;
    }

    @Override
    public PolicyContext next() {
      if (!hasNext()) {
        throw new NoSuchElementException();
      }
      return policyIterators.get(iteratorIndex).next();
    }
  }

  /**
   * A class that allows iterating over policies of a user using iterator of iterators. For a user, the policies in user
   * roles are visited one by one, followed by policies in the teams that a user belongs to.
   */
  static class UserPolicyIterator implements Iterator<PolicyContext> {
    private final User user;
    private int iteratorIndex = 0;
    private final List<Iterator<PolicyContext>> iterators = new ArrayList<>();

    /** Policy iterator for a user */
    UserPolicyIterator(User user, List<UUID> teamsVisited) {
      this.user = user;

      // Iterate over policies in user role
      if (user.getRoles() != null) {
        iterators.add(new RolePolicyIterator(Entity.USER, user.getName(), user.getRoles()));
      }

      if (!Boolean.TRUE.equals(user.getIsBot())) {
        // Finally, iterate over policies of teams to which the user belongs to
        // Note that ** Bots don't inherit policies or default roles from teams **
        for (EntityReference team : user.getTeams()) {
          iterators.add(new TeamPolicyIterator(team.getId(), teamsVisited));
        }
      }
    }

    @Override
    public boolean hasNext() {
      while (iteratorIndex < iterators.size()) {
        if (iterators.get(iteratorIndex).hasNext()) {
          return true;
        }
        iteratorIndex++;
      }
      LOG.debug("Subject {} policy iteration done" + user.getName());
      return false;
    }

    @Override
    public PolicyContext next() {
      if (!hasNext()) {
        throw new NoSuchElementException();
      }
      return iterators.get(iteratorIndex).next();
    }
  }

  /**
   * A class that allows iterating over policies of a team using iterator of iterators. For a team, the policies in team
   * roles are visited one by one, followed by the policies in the parent teams.
   */
  static class TeamPolicyIterator implements Iterator<PolicyContext> {
    private int iteratorIndex = 0;
    private final List<Iterator<PolicyContext>> iterators = new ArrayList<>();

    /** Policy iterator for a team */
    TeamPolicyIterator(UUID teamId, List<UUID> teamsVisited) {
      Team team = SubjectCache.getInstance().getTeam(teamId);

      // If a team is already visited (because user can belong to multiple teams
      // and a team can belong to multiple teams) then don't visit the roles/policies of that team
      if (!teamsVisited.contains(teamId)) {
        teamsVisited.add(teamId);
        if (team.getDefaultRoles() != null) {
          iterators.add(new RolePolicyIterator(Entity.TEAM, team.getName(), team.getDefaultRoles()));
        }
        if (team.getPolicies() != null) {
          iterators.add(new PolicyIterator(Entity.TEAM, team.getName(), null, team.getPolicies()));
        }
        for (EntityReference parentTeam : listOrEmpty(team.getParents())) {
          iterators.add(new TeamPolicyIterator(parentTeam.getId(), teamsVisited));
        }
      }
    }

    @Override
    public boolean hasNext() {
      while (iteratorIndex < iterators.size()) {
        if (iterators.get(iteratorIndex).hasNext()) {
          return true;
        }
        iteratorIndex++;
      }
      return false;
    }

    @Override
    public PolicyContext next() {
      if (!hasNext()) {
        throw new NoSuchElementException();
      }
      return iterators.get(iteratorIndex).next();
    }
  }
}
