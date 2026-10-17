/*
 *  Copyright 2026 Collate
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
import static org.openmetadata.it.factories.TeamHierarchyTestFactory.groupUnder;
import static org.openmetadata.it.factories.TeamHierarchyTestFactory.team;
import static org.openmetadata.it.factories.TeamHierarchyTestFactory.user;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;

/**
 * collate#2708: listing teams or users with {@code fields=owns} read every owned asset on its own,
 * one statement per asset. The Teams page asks for {@code owns} on every visit, so a deployment
 * whose teams owned 30K assets ran about 30K statements per page load, and the entity cache, which
 * keeps an entry for 30 seconds, rarely absorbed them.
 *
 * <p>How many assets a team or user owns must not change how often the listing reads their table.
 * {@code SqlQueryCounter.forRequests} decorates the application-wide SQL logger and matches any
 * in-flight request, so this class has to run alone.
 */
@Isolated("Decorates the application's SQL logger to count statements for one request")
@ExtendWith(TestNamespaceExtension.class)
class TeamUserOwnsFanOutIT {

  private static final String OWNED_ASSET_TABLE = "from storage_container_entity";

  @Test
  void listingTeamsReadsOwnedAssetsTheSameWhateverTheirCount(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Team narrowParent = department(ns, "narrow");
    Team wideParent = department(ns, "wide");
    Team narrowGroup = groupUnder(ns, "narrowgroup", narrowParent);
    Team wideGroup = groupUnder(ns, "widegroup", wideParent);
    Set<UUID> narrowAssets = containersOwnedBy(ns, service, narrowGroup, "narrow", 2);
    Set<UUID> wideAssets = containersOwnedBy(ns, service, wideGroup, "wide", 30);

    assertEquals(narrowAssets, ownsOfOnlyListedTeam(narrowParent));
    assertEquals(wideAssets, ownsOfOnlyListedTeam(wideParent));

    int narrow = coldReadsOfOwnedAssets(() -> ownsOfOnlyListedTeam(narrowParent));
    int wide = coldReadsOfOwnedAssets(() -> ownsOfOnlyListedTeam(wideParent));

    assertEquals(
        narrow,
        wide,
        "Fifteen times the owned assets must not cost more reads of their table: owned "
            + "references are resolved in one batch per entity type");
  }

  @Test
  void listingUsersReadsOwnedAssetsTheSameWhateverTheirCount(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Team narrowGroup = groupUnder(ns, "narrowmembers", department(ns, "narrowusers"));
    Team wideGroup = groupUnder(ns, "widemembers", department(ns, "wideusers"));
    // A user's owns combines what the user owns directly with what the user's teams own; each
    // side is a separate lookup, so both get assets here.
    Set<UUID> narrowAssets = memberOwningAssets(ns, service, narrowGroup, "narrow", 1);
    Set<UUID> wideAssets = memberOwningAssets(ns, service, wideGroup, "wide", 15);

    assertEquals(narrowAssets, ownsOfOnlyListedUser(narrowGroup));
    assertEquals(wideAssets, ownsOfOnlyListedUser(wideGroup));

    int narrow = coldReadsOfOwnedAssets(() -> ownsOfOnlyListedUser(narrowGroup));
    int wide = coldReadsOfOwnedAssets(() -> ownsOfOnlyListedUser(wideGroup));

    assertEquals(
        narrow,
        wide,
        "Fifteen times the owned assets must not cost more reads of their table: owned "
            + "references are resolved in one batch per entity type");
  }

  private static Team department(TestNamespace ns, String prefix) {
    return team(
        new CreateTeam().withName(ns.prefix(prefix + "dept")).withTeamType(TeamType.DEPARTMENT));
  }

  private static Set<UUID> memberOwningAssets(
      TestNamespace ns, StorageService service, Team group, String prefix, int perSide) {
    String name = user(ns, prefix, List.of(group.getId()));
    EntityReference member = SdkClients.adminClient().users().getByName(name).getEntityReference();
    Set<UUID> assets = new HashSet<>();
    assets.addAll(containersOwnedBy(ns, service, member, prefix + "direct", perSide));
    assets.addAll(containersOwnedBy(ns, service, group, prefix + "team", perSide));
    return assets;
  }

  private static Set<UUID> containersOwnedBy(
      TestNamespace ns, StorageService service, Team team, String prefix, int count) {
    return containersOwnedBy(ns, service, team.getEntityReference(), prefix, count);
  }

  private static Set<UUID> containersOwnedBy(
      TestNamespace ns, StorageService service, EntityReference owner, String prefix, int count) {
    Set<UUID> ids = new HashSet<>();
    for (int i = 0; i < count; i++) {
      CreateContainer create =
          new CreateContainer()
              .withName(ns.prefix(prefix + "asset" + i))
              .withService(service.getFullyQualifiedName())
              .withOwners(List.of(owner));
      ids.add(SdkClients.adminClient().containers().create(create).getId());
    }
    return ids;
  }

  private static Set<UUID> ownsOfOnlyListedTeam(Team parent) {
    ListParams params =
        new ListParams()
            .setFields("owns")
            .setLimit(10)
            .addFilter("parentTeam", parent.getFullyQualifiedName());
    List<Team> teams = SdkClients.adminClient().teams().list(params).getData();
    assertEquals(1, teams.size(), "The department should list exactly its one group");
    return ids(teams.get(0).getOwns());
  }

  private static Set<UUID> ownsOfOnlyListedUser(Team group) {
    ListParams params =
        new ListParams().setFields("owns").setLimit(10).addFilter("team", group.getName());
    List<User> users = SdkClients.adminClient().users().list(params).getData();
    assertEquals(1, users.size(), "The group should list exactly its one member");
    return ids(users.get(0).getOwns());
  }

  private static Set<UUID> ids(List<EntityReference> refs) {
    return refs.stream().map(EntityReference::getId).collect(Collectors.toSet());
  }

  /**
   * Counts reads of the owned assets' table for one listing, with the entity cache empty. The
   * cache drops an entry 30 seconds after loading it, so a Teams page visit normally finds it
   * cold; a warm cache would also hide a per-asset read entirely.
   */
  private static int coldReadsOfOwnedAssets(Supplier<Set<UUID>> listing) {
    // Warm the auth caches so the count reflects the listing itself.
    listing.get();
    EntityRepository.CACHE_WITH_ID.invalidateAll();
    try (SqlQueryCounter counter =
        SqlQueryCounter.forRequests(Entity.getJdbi(), OWNED_ASSET_TABLE)) {
      listing.get();
      return counter.count();
    }
  }
}
