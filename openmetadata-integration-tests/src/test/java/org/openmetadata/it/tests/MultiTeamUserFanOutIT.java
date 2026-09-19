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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;

/**
 * Issue #19778: reading a user resolved the team hierarchy one {@code Team} entity at a time, once
 * per team the user belonged to, and every one of those reads pulled its own {@code defaultRoles},
 * {@code parents}, {@code policies} and {@code domains}. A member of 100 groups therefore paid
 * about a thousand {@code entity_relationship} queries for a single read, and the reporter measured
 * page loads going from seconds to minutes.
 *
 * <p>{@link #readingAUserCostsTheSameWhateverTheTeamCount()} is the regression guard: the statement
 * count must be driven by the depth of the hierarchy, not by how many teams sit at the bottom of
 * it. The other test pins the semantics that walk has to keep -- roles and domains still reach the
 * user from every level above.
 */
@Isolated("Decorates the application's SQL logger to count statements for one request")
@ExtendWith(TestNamespaceExtension.class)
class MultiTeamUserFanOutIT {

  private static final String USER_FIELDS = "teams,roles,domains,personas,defaultPersona";
  private static final String RELATIONSHIP_TABLE = "entity_relationship";

  @Test
  void readingAUserCostsTheSameWhateverTheTeamCount(TestNamespace ns) {
    Team department = departmentUnderDivision(ns, "fanout", null);
    String narrowUser = userInGroups(ns, "narrow", department, 2);
    String wideUser = userInGroups(ns, "wide", department, 30);

    int narrow = relationshipQueriesToRead(narrowUser);
    int wide = relationshipQueriesToRead(wideUser);

    assertEquals(
        narrow,
        wide,
        "Fifteen times the teams must not cost more queries: the hierarchy walk is batched per "
            + "level, so only its depth may show up in the statement count");
  }

  @Test
  void rolesAndDomainsStillReachTheUserFromEveryLevelAbove(TestNamespace ns) {
    Domain domain = domain(ns, "inherited");
    Role role = SdkClients.adminClient().roles().getByName("DataSteward");
    Team department = departmentUnderDivision(ns, "inherit", domain);
    Team group =
        team(
            new CreateTeam()
                .withName(ns.prefix("inheritgroup"))
                .withTeamType(TeamType.GROUP)
                .withDefaultRoles(List.of(role.getId()))
                .withParents(List.of(department.getId())));
    String userName = user(ns, "inheritor", List.of(group.getId()));

    User read = SdkClients.adminClient().users().getByName(userName, USER_FIELDS);

    assertTrue(
        names(read.getInheritedRoles()).contains(role.getName()),
        "The group's default role must still reach its member: " + names(read.getInheritedRoles()));
    assertTrue(
        fqns(read.getDomains()).contains(domain.getFullyQualifiedName()),
        "The department's domain must still reach a member of a team below it: "
            + fqns(read.getDomains()));
  }

  private int relationshipQueriesToRead(String userName) {
    OpenMetadataClient admin = SdkClients.adminClient();
    // Warm the entity and auth caches so the count reflects a steady-state request rather than the
    // first one after a write.
    admin.users().getByName(userName, USER_FIELDS);
    try (SqlQueryCounter counter =
        SqlQueryCounter.forRequests(Entity.getJdbi(), RELATIONSHIP_TABLE)) {
      admin.users().getByName(userName, USER_FIELDS);
      return counter.count();
    }
  }

  /** Organization -> business unit -> division -> department, so the walk has levels to climb. */
  private Team departmentUnderDivision(TestNamespace ns, String prefix, Domain domain) {
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

  private String userInGroups(TestNamespace ns, String prefix, Team department, int groupCount) {
    List<UUID> groups = new ArrayList<>();
    for (int i = 0; i < groupCount; i++) {
      groups.add(
          team(new CreateTeam()
                  .withName(ns.prefix(prefix + "group" + i))
                  .withTeamType(TeamType.GROUP)
                  .withParents(List.of(department.getId())))
              .getId());
    }
    return user(ns, prefix, groups);
  }

  private Team team(CreateTeam create) {
    return SdkClients.adminClient().teams().create(create);
  }

  private String user(TestNamespace ns, String prefix, List<UUID> teams) {
    // The email is validated, so keep the local part short and alphanumeric.
    String name = prefix + "user" + ns.shortPrefix();
    SdkClients.adminClient()
        .users()
        .create(new CreateUser().withName(name).withEmail(name + "@test.com").withTeams(teams));
    return name;
  }

  private Domain domain(TestNamespace ns, String prefix) {
    return SdkClients.adminClient()
        .domains()
        .create(
            new CreateDomain()
                .withName(ns.prefix(prefix + "domain"))
                .withDomainType(CreateDomain.DomainType.AGGREGATE)
                .withDescription("Domain inherited through the team hierarchy"));
  }

  private static List<String> names(List<EntityReference> refs) {
    return refs == null ? List.of() : refs.stream().map(EntityReference::getName).toList();
  }

  private static List<String> fqns(List<EntityReference> refs) {
    return refs == null
        ? List.of()
        : refs.stream().map(EntityReference::getFullyQualifiedName).toList();
  }
}
