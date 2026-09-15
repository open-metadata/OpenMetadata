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

package org.openmetadata.service.jdbi3;

import com.fasterxml.jackson.core.type.TypeReference;
import com.google.common.util.concurrent.Striped;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.locks.Lock;
import java.util.stream.Collectors;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * Thin, app-managed (no FK, no versioning/audit/soft-delete) wrapper around the {@code
 * user_preferences} table. See {@link CollectionDAO.UserPreferencesDAO}.
 *
 * <p>{@code preferences} is stored as a JSON array of typed discriminated unions, each shaped
 * {@code {type, config}} (see {@code openmetadata-spec/.../api/teams/preferences/*.json}).
 * Entries are addressed by their {@code type} field; at most one entry per {@code type} exists in
 * the list at a time.
 *
 * <p>Concurrency: {@link #putByType} and {@link #deleteByType} do a
 * {@code get()} → mutate list → {@code upsert()} cycle with a full-row JSON overwrite. Two
 * concurrent writes for different {@code type}s targeting the same user would both read the same
 * base list and the second persist would clobber the first (lost update). We serialize per-user
 * with {@link Striped} locks — same pattern used elsewhere in this service (see
 * {@code CachedLineage}). This is a per-JVM guarantee; cross-JVM races on the same user are still
 * possible but unlikely in practice (a user typically hits a single node via sticky sessions or
 * the auth cookie), and the ON CONFLICT / ON DUPLICATE KEY upsert prevents duplicate rows.
 */
@Repository
public class UserPreferencesRepository {
  private static final TypeReference<List<Object>> PREFERENCES_TYPE = new TypeReference<>() {};
  private static final String TYPE_FIELD = "type";

  /**
   * 64 stripes give bounded memory (one lock per stripe) while keeping contention negligible in
   * practice — a user's writes hash to a single stripe, so all their read-modify-write cycles
   * across preference types are serialized regardless of the stripe count.
   */
  private static final Striped<Lock> USER_LOCKS = Striped.lazyWeakLock(64);

  private final CollectionDAO.UserPreferencesDAO dao;

  public UserPreferencesRepository() {
    this.dao = Entity.getCollectionDAO().userPreferencesDAO();
  }

  public List<Object> get(UUID userId) {
    String json = dao.findByUserId(userId);
    return json == null
        ? new ArrayList<>()
        : new ArrayList<>(JsonUtils.readValue(json, PREFERENCES_TYPE));
  }

  /** Replaces the entry matching {@code type}, or appends {@code typedPreference} if absent. */
  public List<Object> putByType(UUID userId, String type, Object typedPreference) {
    Lock lock = USER_LOCKS.get(userId);
    lock.lock();
    try {
      List<Object> current = get(userId);
      boolean replaced = false;
      List<Object> updated = new ArrayList<>();
      for (Object item : current) {
        if (type.equals(typeOf(item))) {
          updated.add(typedPreference);
          replaced = true;
        } else {
          updated.add(item);
        }
      }
      if (!replaced) {
        updated.add(typedPreference);
      }
      persist(userId, updated);
      return updated;
    } finally {
      lock.unlock();
    }
  }

  /** Removes any entry matching {@code type}. No-op (but still persists) if absent. */
  public List<Object> deleteByType(UUID userId, String type) {
    Lock lock = USER_LOCKS.get(userId);
    lock.lock();
    try {
      List<Object> updated =
          get(userId).stream()
              .filter(item -> !type.equals(typeOf(item)))
              .collect(Collectors.toList());
      persist(userId, updated);
      return updated;
    } finally {
      lock.unlock();
    }
  }

  public void delete(UUID userId) {
    dao.deleteByUserId(userId);
  }

  private void persist(UUID userId, List<Object> preferences) {
    dao.upsert(userId, JsonUtils.pojoToJson(preferences), System.currentTimeMillis());
  }

  /** Reads the discriminator {@code type} field off a preference entry, typed or raw map. */
  private static String typeOf(Object preferenceEntry) {
    Map<String, Object> asMap = JsonUtils.getMap(preferenceEntry);
    Object type = asMap.get(TYPE_FIELD);
    return type == null ? null : type.toString();
  }
}
