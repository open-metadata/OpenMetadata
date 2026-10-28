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

package org.openmetadata.it.factories;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;

/**
 * Builds the multi-level team hierarchies the inherited-role, inherited-domain and authorization
 * tests need. Every name is namespaced, so the tests using these stay safe to run concurrently.
 */
public class TeamHierarchyTestFactory {

  private TeamHierarchyTestFactory() {}

  /** Organization -> business unit -> division -> department, so an ancestry walk has levels. */
  public static Team departmentUnderDivision(TestNamespace ns, String prefix, Domain domain) {
    Team businessUnit =
        team(
            new CreateTeam()
                .withName(ns.prefix(prefix + "bu"))
                .withTeamType(TeamType.BUSINESS_UNIT));
    Team division =
        team(
            new CreateTeam()
                .withName(ns.prefix(prefix + "div"))
                .withTeamType(TeamType.DIVISION)
                .withParents(List.of(businessUnit.getId())));
    CreateTeam department =
        new CreateTeam()
            .withName(ns.prefix(prefix + "dept"))
            .withTeamType(TeamType.DEPARTMENT)
            .withParents(List.of(division.getId()));
    if (domain != null) {
      department.withDomains(List.of(domain.getFullyQualifiedName()));
    }
    return team(department);
  }

  public static Team team(CreateTeam create) {
    return SdkClients.adminClient().teams().create(create);
  }

  public static Team groupUnder(TestNamespace ns, String name, Team parent, UUID... defaultRoles) {
    CreateTeam create =
        new CreateTeam()
            .withName(ns.prefix(name))
            .withTeamType(TeamType.GROUP)
            .withParents(List.of(parent.getId()));
    if (defaultRoles.length > 0) {
      create.withDefaultRoles(List.of(defaultRoles));
    }
    return team(create);
  }

  /** A user in {@code groupCount} sibling groups under {@code department}; returns the name. */
  public static String userInGroups(
      TestNamespace ns, String prefix, Team department, int groupCount) {
    List<UUID> groups = new ArrayList<>();
    for (int i = 0; i < groupCount; i++) {
      groups.add(groupUnder(ns, prefix + "group" + i, department).getId());
    }
    return user(ns, prefix, groups);
  }

  /** Creates a user in the given teams and returns the name. */
  public static String user(TestNamespace ns, String prefix, List<UUID> teams) {
    // The email is validated, so keep the local part short and alphanumeric.
    String name = prefix + "user" + ns.shortPrefix();
    SdkClients.adminClient()
        .users()
        .create(new CreateUser().withName(name).withEmail(name + "@test.com").withTeams(teams));
    return name;
  }

  public static Domain domain(TestNamespace ns, String prefix) {
    return SdkClients.adminClient()
        .domains()
        .create(
            new CreateDomain()
                .withName(ns.prefix(prefix + "domain"))
                .withDomainType(CreateDomain.DomainType.AGGREGATE)
                .withDescription("Domain inherited through the team hierarchy"));
  }

  public static List<String> names(List<EntityReference> refs) {
    return refs == null ? List.of() : refs.stream().map(EntityReference::getName).toList();
  }

  public static List<String> fqns(List<EntityReference> refs) {
    return refs == null
        ? List.of()
        : refs.stream().map(EntityReference::getFullyQualifiedName).toList();
  }
}
