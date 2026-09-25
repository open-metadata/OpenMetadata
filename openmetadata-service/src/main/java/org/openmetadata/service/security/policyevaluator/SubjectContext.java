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
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

/** Subject context used for Access Control Policies */
@Slf4j
public record SubjectContext(User user, String impersonatedBy, String requestedPersona) {
  private static final int MAX_LOGGED_PERSONA_LENGTH = 64;

  public SubjectContext(User user, String impersonatedBy) {
    this(user, impersonatedBy, null);
  }

  public static SubjectContext getSubjectContext(String userName) {
    return getSubjectContext(userName, null, null);
  }

  public static SubjectContext getSubjectContext(String userName, String impersonatedBy) {
    return getSubjectContext(userName, impersonatedBy, null);
  }

  public static SubjectContext getSubjectContext(
      String userName, String impersonatedBy, String requestedPersona) {
    User user = SubjectCache.getUserContext(userName);
    return new SubjectContext(user, impersonatedBy, requestedPersona);
  }

  /**
   * Returns the validated persona preference for personalization such as UI and AI context.
   *
   * <p>This value must never be used for authorization or access-control decisions. Roles and
   * policies remain the authorization inputs.
   */
  public EntityReference getActivePersona() {
    EntityReference activePersona = findRequestedPersona();
    if (activePersona == null) {
      if (!nullOrEmpty(requestedPersona)) {
        LOG.warn(
            "Requested persona '{}' is not assigned to user '{}'; using the default persona",
            sanitizeRequestedPersonaForLog(),
            user.getName());
      }
      activePersona = user.getDefaultPersona();
    }
    return activePersona;
  }

  public boolean hasPersona(UUID personaId) {
    return listOrEmpty(user.getPersonas()).stream().anyMatch(ref -> personaId.equals(ref.getId()))
        || listOrEmpty(user.getInheritedPersonas()).stream()
            .anyMatch(ref -> personaId.equals(ref.getId()))
        || (user.getDefaultPersona() != null && personaId.equals(user.getDefaultPersona().getId()));
  }

  private EntityReference findRequestedPersona() {
    EntityReference requested = findRequestedPersona(user.getPersonas());
    if (requested == null) {
      requested = findRequestedPersona(user.getInheritedPersonas());
    }
    if (requested == null && matchesRequestedPersona(user.getDefaultPersona())) {
      requested = user.getDefaultPersona();
    }
    return requested;
  }

  private EntityReference findRequestedPersona(List<EntityReference> personas) {
    EntityReference requested = null;
    for (EntityReference persona : listOrEmpty(personas)) {
      if (matchesRequestedPersona(persona)) {
        requested = persona;
        break;
      }
    }
    return requested;
  }

  private String sanitizeRequestedPersonaForLog() {
    return requestedPersona
        .codePoints()
        .filter(SubjectContext::isSafeLogCodePoint)
        .limit(MAX_LOGGED_PERSONA_LENGTH)
        .collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append)
        .toString();
  }

  private static boolean isSafeLogCodePoint(int codePoint) {
    int characterType = Character.getType(codePoint);
    return characterType != Character.CONTROL
        && characterType != Character.FORMAT
        && characterType != Character.LINE_SEPARATOR
        && characterType != Character.PARAGRAPH_SEPARATOR
        && characterType != Character.SURROGATE;
  }

  private boolean matchesRequestedPersona(EntityReference persona) {
    return !nullOrEmpty(requestedPersona)
        && persona != null
        && (requestedPersona.equalsIgnoreCase(persona.getFullyQualifiedName())
            || requestedPersona.equalsIgnoreCase(persona.getName())
            || (persona.getId() != null
                && requestedPersona.equalsIgnoreCase(persona.getId().toString())));
  }

  public boolean isAdmin() {
    return Boolean.TRUE.equals(user.getIsAdmin());
  }

  public boolean isBot() {
    return Boolean.TRUE.equals(user.getIsBot());
  }

  public boolean isOwner(List<EntityReference> owners) {
    if (nullOrEmpty(owners)) {
      return false;
    }
    for (EntityReference owner : owners) {
      if (owner.getType().equals(Entity.USER) && owner.getName().equals(user.getName())) {
        return true; // Owner is same as user.
      }
      if (owner.getType().equals(Entity.TEAM)) {
        for (EntityReference userTeam : listOrEmpty(user.getTeams())) {
          if (userTeam.getName().equals(owner.getName())) {
            return true; // Owner is a team, and the user is part of this team.
          }
        }
      }
    }
    return false;
  }

  public boolean isReviewer(List<EntityReference> reviewers) {
    if (nullOrEmpty(reviewers)) {
      return false;
    }
    for (EntityReference reviewer : reviewers) {
      // Reviewer is the same user
      if (reviewer.getType().equals(Entity.USER) && reviewer.getName().equals(user.getName())) {
        return true;
      }

      // Reviewer is a team and user is a member of that team
      if (reviewer.getType().equals(Entity.TEAM)) {
        for (EntityReference userTeam : listOrEmpty(user.getTeams())) {
          if (userTeam.getName().equals(reviewer.getName())) {
            return true;
          }
        }
      }
    }
    return false;
  }

  public boolean hasDomains(List<EntityReference> domains) {
    return checkDomainHierarchyAccess(user.getDomains(), domains);
  }

  /**
   * Checks if user can access resource domains through hierarchy.
   * Parent domain users can access sub-domain resources.
   */
  private boolean checkDomainHierarchyAccess(
      List<EntityReference> userDomains, List<EntityReference> resourceDomains) {

    if (listOrEmpty(resourceDomains).isEmpty()) return true; // No restrictions
    if (listOrEmpty(userDomains).isEmpty()) return false; // No user domains

    // Simple nested loops - optimal for typical small domain counts
    for (EntityReference userDomain : userDomains) {
      String userDomainFQN = userDomain.getFullyQualifiedName();
      for (EntityReference resourceDomain : resourceDomains) {
        if (isDomainParentOrEqual(userDomainFQN, resourceDomain.getFullyQualifiedName())) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Checks if userDomainFQN is an parent of or equal to resourceDomainFQN.
   * Example: "Engineering" is parent of "Engineering.Backend.Services"
   */
  private static boolean isDomainParentOrEqual(String userDomainFQN, String resourceDomainFQN) {
    if (userDomainFQN.equals(resourceDomainFQN)) return true; // Exact match

    // Check if user domain is parent by walking up resource domain hierarchy
    String parentDomainFQN = FullyQualifiedName.getParentFQN(resourceDomainFQN);
    while (parentDomainFQN != null) {
      if (parentDomainFQN.equals(userDomainFQN)) return true;
      parentDomainFQN = FullyQualifiedName.getParentFQN(parentDomainFQN);
    }
    return false;
  }

  /** Returns true if the user of this SubjectContext is under the team hierarchy of parentTeam */
  public boolean isUserUnderTeam(String parentTeam) {
    // The subject's own hierarchy is resolved once per user and reused. A rule condition such as
    // inAnyTeam() or matchTeam() is evaluated for every rule of every policy against every entity
    // in a listing, so walking the hierarchy here is the difference between one resolution per
    // request and thousands (#19778).
    return SubjectCache.getTeamNamesInHierarchy(user.getName(), user.getTeams())
        .contains(parentTeam);
  }

  /** Returns true if any of the resource owners is under the team hierarchy of parentTeam */
  public boolean isTeamAsset(String parentTeam, List<EntityReference> owners) {
    boolean isUnderTeam = false;
    for (EntityReference owner : listOrEmpty(owners)) {
      if (isOwnerUnderTeam(owner, parentTeam)) {
        isUnderTeam = true;
        break;
      }
    }
    return isUnderTeam;
  }

  private boolean isOwnerUnderTeam(EntityReference owner, String parentTeam) {
    boolean result = false;
    try {
      if (owner.getType().equals(Entity.USER)) {
        result = getSubjectContext(owner.getName()).isUserUnderTeam(parentTeam);
      } else if (owner.getType().equals(Entity.TEAM)) {
        result = isInTeam(parentTeam, owner);
      }
    } catch (Exception ex) {
      // Owner could not be resolved (e.g. a deleted user/team still referenced as an owner).
      // getSubjectContext(userName) throws EntityNotFoundException for an unresolved user; without
      // this catch that would propagate out of isTeamAsset and abort the multi-owner scan, so an
      // asset owned by [deletedUser, matchingTeam] would wrongly deny the matching team. Treat this
      // owner as not-under-team and let isTeamAsset keep checking the rest (OR semantics).
    }
    return result;
  }

  /** Return true if the team is part of the hierarchy of parentTeam */
  public static boolean isInTeam(String parentTeam, EntityReference team) {
    return TeamHierarchyResolver.isInTeam(parentTeam, team);
  }

  public static List<EntityReference> getRolesForTeams(List<EntityReference> teams) {
    return TeamHierarchyResolver.rolesForTeams(teams);
  }

  public List<EntityReference> getUserDomains() {
    return listOrEmpty(user.getDomains());
  }

  // Iterate over all the policies of the team hierarchy the user belongs to
  public Iterator<PolicyContext> getPolicies(List<EntityReference> resourceOwners) {
    // Get cached user policies (roles + team hierarchy)
    List<PolicyContext> cachedPolicies = SubjectCache.getPolicies(user.getName());

    // If no resource owners, return cached policies directly
    if (nullOrEmpty(resourceOwners)) {
      return cachedPolicies.iterator();
    }

    // Add resource owner team policies (not cached - resource specific)
    List<PolicyContext> allPolicies = new ArrayList<>(cachedPolicies);

    // Get all teams visited during user policy loading to avoid duplicates
    List<UUID> teamsVisited = SubjectCache.getVisitedTeams(user.getName());

    for (EntityReference owner : resourceOwners) {
      if (owner.getType().equals(Entity.TEAM)) {
        allPolicies.addAll(SubjectCache.getTeamPoliciesForResource(owner.getId(), teamsVisited));
      }
    }

    return allPolicies.iterator();
  }

  public List<EntityReference> getTeams() {
    return user.getTeams();
  }

  /** Returns true if the user has any of the roles (either direct or inherited roles) */
  public boolean hasAnyRole(String roles) {
    // Same reasoning as isUserUnderTeam: hasAnyRole() is a rule condition, so it runs once per
    // rule per entity. Resolve the subject's inherited roles once and answer from the set.
    return hasRole(user.getRoles(), roles)
        || SubjectCache.getInheritedRoleNames(user.getName(), user.getTeams()).contains(roles);
  }

  /** Returns true if the user has domain-only access role. */
  public boolean hasDomainOnlyAccessRole() {
    return hasAnyRole("DomainOnlyAccessRole");
  }

  /** Return true if the given user has any roles the list of roles */
  public static boolean hasRole(User user, String role) {
    // Direct roles first: a user carrying the role needs no hierarchy resolution at all.
    return hasRole(user.getRoles(), role)
        || hasRole(TeamHierarchyResolver.rolesForTeams(user.getTeams()), role);
  }

  private static boolean hasRole(List<EntityReference> userRoles, String expectedRole) {
    return listOrEmpty(userRoles).stream()
        .anyMatch(userRole -> userRole.getName().equals(expectedRole));
  }

  @Getter
  public static class PolicyContext {
    private final String entityType;
    private final String entityName;
    private final String roleName;
    private final String policyName;
    private final List<CompiledRule> rules;

    PolicyContext(
        String entityType,
        String entityName,
        String role,
        String policy,
        List<CompiledRule> rules) {
      this.entityType = entityType;
      this.entityName = entityName;
      this.roleName = role;
      this.policyName = policy;
      this.rules = rules;
    }
  }

  /** PolicyIterator goes over policies from a set of policies one by one. */
  static class PolicyIterator implements Iterator<PolicyContext> {

    // When executing roles from a policy, entity type User or Team to which the Role is attached
    // to. In case of executing a policy attached to a team, the entityType is Team.
    private final String entityType;

    // User or Team name to which the Role or Policy is attached to
    private final String entityName;

    // Name of the role from which the policy is from. If policy is not part of the role, but from
    // directly attaching it to a Team, then null
    private final String roleName;

    // Index to the current policy being evaluation
    private int policyIndex = 0;

    // List of policies to execute
    private final List<EntityReference> policies;

    PolicyIterator(
        String entityType, String entityName, String roleName, List<EntityReference> policies) {
      this.entityType = entityType;
      this.entityName = entityName;
      this.roleName = roleName;
      this.policies = listOrEmpty(policies);
    }

    @Override
    public boolean hasNext() {
      if (policyIndex >= policies.size()) {
        LOG.debug(
            "iteration over policy attached to entity {}:{} role {} is completed",
            entityType,
            entityName,
            roleName);
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
          entityType, entityName, roleName, policy.getName(), getPolicyRules(policy.getId()));
    }

    private static List<CompiledRule> getPolicyRules(UUID policyId) {
      Policy policy = Entity.getEntity(Entity.POLICY, policyId, "rules", Include.NON_DELETED);
      List<CompiledRule> rules = new ArrayList<>();
      for (Rule r : policy.getRules()) {
        rules.add(new CompiledRule(r));
      }
      return rules;
    }
  }
}
