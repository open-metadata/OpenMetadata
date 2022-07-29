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
package org.openmetadata.catalog.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import org.openmetadata.catalog.EntityInterface;
import org.openmetadata.catalog.entity.policies.Policy;
import org.openmetadata.catalog.entity.policies.accessControl.Rule;
import org.openmetadata.catalog.entity.teams.Role;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.security.policyevaluator.SubjectContext.PolicyContext;
import org.openmetadata.catalog.type.EntityReference;

public class SubjectContextTest {
  public void testPolicyIterator() {
    System.setProperty("org.apache.commons.logging.LogFactory", "org.apache.commons.logging.impl.LogFactoryImpl");

    // Create team hierarchy team1, team11, team111 each with 3 roles and 3 policies
    List<Role> team1Roles = getRoles("team1", 3);
    List<Policy> team1Policies = getPolicies("team1", 3);
    Team team1 = createTeam("team1", team1Roles, team1Policies, null);

    List<Role> team11Roles = getRoles("team11", 3);
    List<Policy> team11Policies = getPolicies("team11", 3);
    Team team11 = createTeam("team11", team11Roles, team11Policies, List.of(team1));

    List<Role> team12Roles = getRoles("team12", 3);
    List<Policy> team12Policies = getPolicies("team12", 3);
    Team team12 = createTeam("team12", team12Roles, team12Policies, List.of(team1));

    List<Role> team111Roles = getRoles("team111", 3);
    List<Policy> team111Policies = getPolicies("team111", 3);
    Team team111 = createTeam("team111", team111Roles, team111Policies, List.of(team11, team12));

    // Add user to team111
    List<Role> userRoles = getRoles("user", 3);
    List<EntityReference> userRolesRef = toEntityReferences(userRoles);
    User user = new User().withName("user").withRoles(userRolesRef).withTeams(List.of(team111.getEntityReference()));
    SubjectContext.USER_CACHE.put("user", new SubjectContext(user));

    //
    // Check iteration order of the policies
    //
    List<String> expectedPolicyOrder = new ArrayList<>();
    expectedPolicyOrder.addAll(getPolicyListFromRoles(userRoles)); // First polices associated with user roles
    expectedPolicyOrder.addAll(getPolicyListFromRoles(team111Roles)); // Next parent team111 roles
    expectedPolicyOrder.addAll(getPolicyList(team111Policies)); // Next parent team111 policies
    expectedPolicyOrder.addAll(getPolicyListFromRoles(team11Roles)); // Next parent of team111 team11 roles first
    expectedPolicyOrder.addAll(getPolicyList(team11Policies)); // Next parent of team111 team11 policies first
    expectedPolicyOrder.addAll(getPolicyListFromRoles(team1Roles)); // Next parent of team11 team1 roles
    expectedPolicyOrder.addAll(getPolicyList(team1Policies)); // Next parent of team11 team1 policies
    expectedPolicyOrder.addAll(getPolicyListFromRoles(team12Roles)); // Next parent of team111 team12 roles next
    expectedPolicyOrder.addAll(getPolicyList(team12Policies)); // Next parent of team111 team12 policies next

    SubjectContext subjectContext = SubjectContext.getSubjectContext(user.getName());
    Iterator<PolicyContext> policyContextIterator = subjectContext.getPolicies();
    int count = 0;
    while (policyContextIterator.hasNext()) {
      PolicyContext policyContext = policyContextIterator.next();
      assertEquals(expectedPolicyOrder.get(count), policyContext.getPolicyName());
      count++;
    }
    assertEquals(expectedPolicyOrder.size(), count);
  }

  private List<Role> getRoles(String prefix, int count) {
    // Create roles with 3 policies each and each policy with 3 rules
    List<Role> roles = new ArrayList<>(count);
    for (int i = 1; i <= count; i++) {
      String name = prefix + "_role_" + i;
      List<EntityReference> policies = toEntityReferences(getPolicies(name, 3));
      Role role = new Role().withName(name).withId(UUID.randomUUID()).withPolicies(policies);
      RoleCache.ROLE_CACHE.put(role.getId(), role);
      roles.add(role);
    }
    return roles;
  }

  private List<Policy> getPolicies(String prefix, int count) {
    List<Policy> policies = new ArrayList<>(count);
    for (int i = 1; i <= count; i++) {
      String name = prefix + "_policy_" + i;
      Policy policy = new Policy().withName(name).withId(UUID.randomUUID()).withRules(getRules(name, 3));
      policies.add(policy);
      PolicyCache.POLICY_CACHE.put(policy.getId(), PolicyCache.getRules(policy));
    }
    return policies;
  }

  private List<Object> getRules(String prefix, int count) {
    List<Object> rules = new ArrayList<>(count);
    for (int i = 1; i <= count; i++) {
      rules.add(new Rule().withName(prefix + "rule" + count));
    }
    return rules;
  }

  private <T extends EntityInterface> List<EntityReference> toEntityReferences(List<T> entities) {
    List<EntityReference> references = new ArrayList<>();
    for (T entity : entities) {
      references.add(entity.getEntityReference());
    }
    return references;
  }

  private List<String> getPolicyListFromRoles(List<Role> roles) {
    List<String> list = new ArrayList<>();
    roles.forEach(r -> list.addAll(getPolicyRefList(r.getPolicies())));
    return list;
  }

  private List<String> getPolicyRefList(List<EntityReference> policies) {
    List<String> list = new ArrayList<>();
    policies.forEach(p -> list.add(p.getName()));
    return list;
  }

  private List<String> getPolicyList(List<Policy> policies) {
    List<String> list = new ArrayList<>();
    policies.forEach(p -> list.add(p.getName()));
    return list;
  }

  private Team createTeam(String name, List<Role> roles, List<Policy> policies, List<Team> parents) {
    List<EntityReference> parentList = parents == null ? null : toEntityReferences(parents);
    Team team =
        new Team()
            .withName(name)
            .withId(UUID.randomUUID())
            .withDefaultRoles(toEntityReferences(roles))
            .withPolicies(toEntityReferences(policies))
            .withParents(parentList);
    SubjectContext.TEAM_CACHE.put(team.getId(), team);
    return team;
  }
}
