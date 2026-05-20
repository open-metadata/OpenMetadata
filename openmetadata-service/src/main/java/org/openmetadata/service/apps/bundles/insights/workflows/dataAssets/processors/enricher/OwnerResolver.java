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

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;

/**
 * Resolves the team name for an entity's first owner. Uses an id-based lookup so it works
 * uniformly on both hydrated and historical raw references — historical {@code entity_extension}
 * rows carry owner refs as bare {@code {id, type}} with no FQN, and an FQN-based lookup would
 * NPE on them.
 *
 * <p>Workflow-scoped cache: the {@link OwnerResolver} is instantiated once per
 * {@link org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsEntityEnricherProcessor},
 * which itself is built once per workflow run. The cache is bounded by Caffeine
 * ({@code maximumSize(10_000)}, {@code expireAfterWrite(15m)}) so a single run on a wide
 * catalog can never grow it unbounded. Negative entries ({@code Optional.empty()}) are cached
 * too — repeatedly looking up a deleted owner would otherwise hit the database for every
 * historical snapshot of every entity that ever referenced it.
 */
@Slf4j
public final class OwnerResolver {

  private static final long MAX_CACHE_SIZE = 10_000L;
  private static final Duration TTL = Duration.ofMinutes(15);

  private final Cache<UUID, Optional<String>> userTeamCache;

  public OwnerResolver() {
    this.userTeamCache =
        Caffeine.newBuilder().maximumSize(MAX_CACHE_SIZE).expireAfterWrite(TTL).build();
  }

  /**
   * Resolve the team name for the given owner ref. Returns {@link Optional#empty()} when:
   *
   * <ul>
   *   <li>{@code owner} is null
   *   <li>{@code owner} is a user but its {@code id} is null (degenerate, shouldn't happen but
   *       guarded anyway)
   *   <li>{@code owner} is a user who exists but has no teams
   *   <li>{@code owner} is a user who has been hard-deleted ({@link EntityNotFoundException}
   *       caught and cached)
   * </ul>
   *
   * <p>For team-typed owners the ref's own {@code name} is returned — no lookup required even on
   * historical raw refs (the type and name are part of the bare-ref shape).
   *
   * @param owner the owner reference (typically the first entry of {@code entity.getOwners()})
   * @param shape carries the hydration shape of the referenced entity; informational — the
   *     resolver uses the same id-based path for both shapes
   */
  public Optional<String> resolveTeamName(EntityReference owner, VersionShape shape) {
    if (owner == null) {
      return Optional.empty();
    }
    if (Entity.TEAM.equals(owner.getType())) {
      return Optional.ofNullable(owner.getName());
    }
    if (owner.getId() == null) {
      return Optional.empty();
    }
    return userTeamCache.get(owner.getId(), this::loadTeamNameByUserId);
  }

  private Optional<String> loadTeamNameByUserId(UUID id) {
    try {
      User user = Entity.getEntity(Entity.USER, id, "teams", Include.ALL);
      if (user == null) {
        return Optional.empty();
      }
      List<EntityReference> teams = user.getTeams();
      if (teams == null || teams.isEmpty()) {
        return Optional.empty();
      }
      return Optional.ofNullable(teams.get(0).getName());
    } catch (EntityNotFoundException e) {
      // Owner deleted between snapshots — cache the empty result so we don't re-hit the DB for
      // every other historical snapshot that referenced this user.
      LOG.debug("User {} not found while resolving owner team", id);
      return Optional.empty();
    } catch (Exception e) {
      // Defensive: any other failure resolves to "no team," logged at warn so it surfaces.
      LOG.warn("Unexpected failure resolving team for user {}: {}", id, e.toString());
      return Optional.empty();
    }
  }
}
