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
import static org.openmetadata.it.factories.TeamHierarchyTestFactory.departmentUnderDivision;
import static org.openmetadata.it.factories.TeamHierarchyTestFactory.userInGroups;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;

/**
 * Issue #19778: reading a user resolved the team hierarchy one {@code Team} entity at a time, once
 * per team the user belonged to, and every one of those reads pulled its own {@code defaultRoles},
 * {@code parents}, {@code policies} and {@code domains}. A member of 100 groups therefore paid
 * about a thousand {@code entity_relationship} queries for a single read, and the reporter measured
 * page loads going from seconds to minutes.
 *
 * <p>The statement count must be driven by the depth of the hierarchy, not by how many teams sit at
 * the bottom of it, and it must stay a small constant now that resolved nodes are memoized. The
 * semantics that walk has to keep are pinned separately, in {@link TeamHierarchyInheritanceIT}.
 *
 * <p>{@code SqlQueryCounter.forRequests} decorates the application-wide SQL logger and matches any
 * in-flight request, so this class has to run alone — which is why the semantic tests live next
 * door rather than here, where they would serialize with it for no reason.
 */
@Isolated("Decorates the application's SQL logger to count statements for one request")
@ExtendWith(TestNamespaceExtension.class)
class MultiTeamUserFanOutIT {

  private static final String USER_FIELDS = "teams,roles,domains,personas,defaultPersona";
  private static final String RELATIONSHIP_TABLE = "entity_relationship";

  /**
   * A warm read issues 8 relationship statements: the user's own teams, roles, personas, default
   * persona, domains, inherited personas and the read bundle. The bound leaves room for an honest
   * new lookup while still failing loudly if the per-team walk ever comes back.
   */
  private static final int MAX_RELATIONSHIP_QUERIES = 15;

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
    assertTrue(
        wide <= MAX_RELATIONSHIP_QUERIES,
        "A warm read must stay a small constant, was " + wide + " statements");
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
}
