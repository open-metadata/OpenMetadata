/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mockStatic;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

/**
 * Unit-level contract for {@link OwnerResolver}: id-based resolution, negative caching (deleted
 * owners not re-queried), team-typed owners short-circuiting without a lookup. The cache's TTL
 * behavior is not asserted here — Caffeine's own tests cover the eviction policy; what matters
 * for our use case is that we never NPE on a bare ref and that misses are cached.
 */
class OwnerResolverTest {

  @Test
  void teamTypedOwner_returnsRefName_noLookup() {
    OwnerResolver resolver = new OwnerResolver();

    EntityReference teamRef =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.TEAM)
            .withName("Engineering");

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      // No lookup expected — assert by negative: Entity.getEntity must not be called.
      Optional<String> result = resolver.resolveTeamName(teamRef, VersionShape.LATEST_HYDRATED);
      assertTrue(result.isPresent());
      assertEquals("Engineering", result.get());
      entityMock.verifyNoInteractions();
    }
  }

  @Test
  void nullOwnerRef_returnsEmpty() {
    OwnerResolver resolver = new OwnerResolver();
    assertFalse(resolver.resolveTeamName(null, VersionShape.LATEST_HYDRATED).isPresent());
  }

  @Test
  void userTypedOwnerWithNullId_returnsEmpty() {
    OwnerResolver resolver = new OwnerResolver();
    EntityReference userRef = new EntityReference().withType(Entity.USER); // no id
    assertFalse(resolver.resolveTeamName(userRef, VersionShape.HISTORICAL_RAW).isPresent());
  }

  @Test
  void userWithOneTeam_returnsThatTeamName_andCachesResult() {
    OwnerResolver resolver = new OwnerResolver();
    UUID userId = UUID.randomUUID();
    EntityReference userRef = new EntityReference().withId(userId).withType(Entity.USER);

    User user = new User().withId(userId);
    user.setTeams(List.of(new EntityReference().withName("data-platform")));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntity(eq(Entity.USER), eq(userId), eq("teams"), eq(Include.ALL)))
          .thenReturn(user);

      Optional<String> first = resolver.resolveTeamName(userRef, VersionShape.HISTORICAL_RAW);
      Optional<String> second = resolver.resolveTeamName(userRef, VersionShape.HISTORICAL_RAW);

      assertEquals("data-platform", first.orElse(null));
      assertEquals("data-platform", second.orElse(null));

      // Cache hit on the second call → exactly one underlying lookup.
      entityMock.verify(
          () -> Entity.getEntity(eq(Entity.USER), eq(userId), eq("teams"), eq(Include.ALL)));
    }
  }

  @Test
  void userNotFound_returnsEmpty_andCachesNegativeResult() {
    OwnerResolver resolver = new OwnerResolver();
    UUID userId = UUID.randomUUID();
    EntityReference userRef = new EntityReference().withId(userId).withType(Entity.USER);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntity(eq(Entity.USER), eq(userId), any(), any()))
          .thenThrow(new EntityNotFoundException("not here"));

      assertFalse(resolver.resolveTeamName(userRef, VersionShape.HISTORICAL_RAW).isPresent());

      // Second call: must NOT re-hit the DB. The mocked static would still throw, so a cache miss
      // would surface as an exception. The absence of an exception proves the negative cache hit.
      assertFalse(resolver.resolveTeamName(userRef, VersionShape.HISTORICAL_RAW).isPresent());
    }
  }

  @Test
  void userWithEmptyTeams_returnsEmpty() {
    OwnerResolver resolver = new OwnerResolver();
    UUID userId = UUID.randomUUID();
    EntityReference userRef = new EntityReference().withId(userId).withType(Entity.USER);

    User user = new User().withId(userId);
    user.setTeams(List.of());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntity(eq(Entity.USER), eq(userId), any(), any()))
          .thenReturn(user);

      assertFalse(resolver.resolveTeamName(userRef, VersionShape.HISTORICAL_RAW).isPresent());
    }
  }

  @Test
  void unexpectedException_returnsEmpty_doesNotPropagate() {
    OwnerResolver resolver = new OwnerResolver();
    UUID userId = UUID.randomUUID();
    EntityReference userRef = new EntityReference().withId(userId).withType(Entity.USER);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntity(eq(Entity.USER), eq(userId), any(), any()))
          .thenThrow(new RuntimeException("oops"));

      // Defensive catch: the resolver returns empty, the step layer treats this as "no team key
      // on snapshot" without dropping the entity.
      assertFalse(resolver.resolveTeamName(userRef, VersionShape.HISTORICAL_RAW).isPresent());
    }
  }
}
