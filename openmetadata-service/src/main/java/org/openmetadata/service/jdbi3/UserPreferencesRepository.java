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
import jakarta.json.JsonPatch;
import jakarta.json.JsonValue;
import java.util.Collections;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * Thin, app-managed (no FK, no versioning/audit/soft-delete) wrapper around the {@code
 * user_preferences} table. See {@link CollectionDAO.UserPreferencesDAO}.
 */
@Repository
public class UserPreferencesRepository {
  private static final TypeReference<Map<String, Object>> PREFERENCES_TYPE =
      new TypeReference<>() {};

  private final CollectionDAO.UserPreferencesDAO dao;

  public UserPreferencesRepository() {
    this.dao = Entity.getCollectionDAO().userPreferencesDAO();
  }

  public Map<String, Object> get(UUID userId) {
    String json = dao.findByUserId(userId);
    return json == null ? Collections.emptyMap() : JsonUtils.readValue(json, PREFERENCES_TYPE);
  }

  public Map<String, Object> patch(UUID userId, JsonPatch patch) {
    Map<String, Object> current = get(userId);
    JsonValue patchedValue = JsonUtils.applyPatch(current, patch);
    Map<String, Object> patched = JsonUtils.readValue(patchedValue.toString(), PREFERENCES_TYPE);
    dao.upsert(userId, JsonUtils.pojoToJson(patched), System.currentTimeMillis());
    return patched;
  }

  public void delete(UUID userId) {
    dao.deleteByUserId(userId);
  }
}
