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

package org.openmetadata.service.migration.utils.v200;

import java.time.Clock;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.ontology.LegacyRelationshipTypeMapper;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public final class OntologyMigration {
  static final String SETTING_NAME = "glossaryTermRelationSettings";
  private static final String SYSTEM_USER = "system";

  private OntologyMigration() {}

  public static void migrateRelationshipTypes(
      final Handle handle, final ConnectionType connectionType) {
    final GlossaryTermRelationSettings settings = loadSettings(handle);
    final LegacyRelationshipTypeMapper mapper = new LegacyRelationshipTypeMapper(Clock.systemUTC());
    final List<RelationshipType> relationshipTypes = mapper.map(settings, SYSTEM_USER);
    relationshipTypes.forEach(type -> upsert(handle, connectionType, type));
    LOG.info("Migrated {} governed ontology relationship types", relationshipTypes.size());
  }

  static GlossaryTermRelationSettings loadSettings(final Handle handle) {
    final String json = readSettingsJson(handle);
    return JsonUtils.readValue(json, GlossaryTermRelationSettings.class);
  }

  private static String readSettingsJson(final Handle handle) {
    return handle
        .createQuery("SELECT json FROM openmetadata_settings WHERE configType = :configType")
        .bind("configType", SETTING_NAME)
        .map((result, context) -> result.getString("json"))
        .findOne()
        .orElse("{}");
  }

  private static void upsert(
      final Handle handle,
      final ConnectionType connectionType,
      final RelationshipType relationshipType) {
    final String sql = upsertSql(connectionType);
    handle
        .createUpdate(sql)
        .bind("fqnHash", EntityUtil.hash(relationshipType.getFullyQualifiedName()))
        .bind("json", JsonUtils.pojoToJson(relationshipType))
        .execute();
  }

  private static String upsertSql(final ConnectionType connectionType) {
    return switch (connectionType) {
      case MYSQL -> "INSERT INTO relationship_type_entity (fqnHash, json) VALUES (:fqnHash, :json) "
          + "ON DUPLICATE KEY UPDATE json = VALUES(json)";
      case POSTGRES -> "INSERT INTO relationship_type_entity (fqnHash, json) "
          + "VALUES (:fqnHash, CAST(:json AS jsonb)) "
          + "ON CONFLICT (fqnHash) DO UPDATE SET json = EXCLUDED.json";
    };
  }
}
