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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.factories.TeamHierarchyTestFactory.departmentUnderDivision;
import static org.openmetadata.it.factories.TeamHierarchyTestFactory.domain;
import static org.openmetadata.it.factories.TeamHierarchyTestFactory.fqns;
import static org.openmetadata.it.factories.TeamHierarchyTestFactory.groupUnder;
import static org.openmetadata.it.factories.TeamHierarchyTestFactory.names;
import static org.openmetadata.it.factories.TeamHierarchyTestFactory.team;
import static org.openmetadata.it.factories.TeamHierarchyTestFactory.user;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * The semantics the batched, memoized hierarchy walk of issue #19778 has to keep: roles and domains
 * still reach a user from every level above, and an administrative change to the hierarchy is
 * visible on the very next read rather than when the cache expires.
 *
 * <p>The query-count guard for the same change is {@link MultiTeamUserFanOutIT}, which has to run
 * alone because it decorates the application's SQL logger. Nothing here does, so these run
 * concurrently.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class TeamHierarchyInheritanceIT {

  private static final String USER_FIELDS = "teams,roles,domains,personas,defaultPersona";

  @Test
  void rolesAndDomainsStillReachTheUserFromEveryLevelAbove(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Domain domain = domain(ns, "inherited");
    Role role = admin.roles().getByName("DataSteward");
    Team department = departmentUnderDivision(ns, "inherit", domain);
    Team group = groupUnder(ns, "inheritgroup", department, role.getId());
    String userName = user(ns, "inheritor", List.of(group.getId()));

    User read = admin.users().getByName(userName, USER_FIELDS);

    assertTrue(
        names(read.getInheritedRoles()).contains(role.getName()),
        "The group's default role must still reach its member: " + names(read.getInheritedRoles()));
    assertTrue(
        fqns(read.getDomains()).contains(domain.getFullyQualifiedName()),
        "The department's domain must still reach a member of a team below it: "
            + fqns(read.getDomains()));
  }

  /**
   * Resolved nodes are memoized, so the writes that change them have to drop that cache. A default
   * role added to a team the user belongs to must reach the user on the very next read, not two
   * minutes later.
   */
  @Test
  void aTeamRoleChangeIsVisibleOnTheNextRead(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Role role = admin.roles().getByName("DataSteward");
    Team group =
        team(new CreateTeam().withName(ns.prefix("rolechange")).withTeamType(TeamType.GROUP));
    String userName = user(ns, "rolechange", List.of(group.getId()));

    assertFalse(
        names(admin.users().getByName(userName, USER_FIELDS).getInheritedRoles())
            .contains(role.getName()),
        "Nothing is inherited before the role is granted");

    Team stored = admin.teams().get(group.getId().toString(), "defaultRoles,parents");
    stored.setDefaultRoles(List.of(role.getEntityReference()));
    admin.teams().update(stored.getId().toString(), stored);

    assertTrue(
        names(admin.users().getByName(userName, USER_FIELDS).getInheritedRoles())
            .contains(role.getName()),
        "The granted role must be inherited immediately, not after the cache expires");
  }

  /**
   * The cached node holds the team's parents, so re-parenting has to be visible straight away too:
   * the user's inherited domains follow the new ancestry.
   */
  @Test
  void aTeamReparentIsVisibleOnTheNextRead(TestNamespace ns) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Domain domain = domain(ns, "reparent");
    Team withoutDomain = departmentUnderDivision(ns, "reparentfrom", null);
    Team withDomain = departmentUnderDivision(ns, "reparentto", domain);
    Team group = groupUnder(ns, "reparentgroup", withoutDomain);
    String userName = user(ns, "reparent", List.of(group.getId()));

    assertFalse(
        fqns(admin.users().getByName(userName, USER_FIELDS).getDomains())
            .contains(domain.getFullyQualifiedName()),
        "Nothing is inherited from a department the user does not sit under");

    Team stored = admin.teams().get(group.getId().toString(), "parents");
    stored.setParents(List.of(withDomain.getEntityReference()));
    admin.teams().update(stored.getId().toString(), stored);

    assertTrue(
        fqns(admin.users().getByName(userName, USER_FIELDS).getDomains())
            .contains(domain.getFullyQualifiedName()),
        "The new parent's domain must be inherited immediately");
  }
}
