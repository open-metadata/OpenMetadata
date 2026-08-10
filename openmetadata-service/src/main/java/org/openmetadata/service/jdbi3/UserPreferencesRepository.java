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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
 */
@Repository
public class UserPreferencesRepository {
  private static final TypeReference<List<Object>> PREFERENCES_TYPE = new TypeReference<>() {};
  private static final String TYPE_FIELD = "type";

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
  }

  /** Removes any entry matching {@code type}. No-op (but still persists) if absent. */
  public List<Object> deleteByType(UUID userId, String type) {
    List<Object> updated =
        get(userId).stream()
            .filter(item -> !type.equals(typeOf(item)))
            .collect(Collectors.toList());
    persist(userId, updated);
    return updated;
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
