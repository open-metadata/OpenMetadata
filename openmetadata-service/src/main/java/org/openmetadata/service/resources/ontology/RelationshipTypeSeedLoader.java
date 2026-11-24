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

package org.openmetadata.service.resources.ontology;

import java.io.IOException;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.RelationshipTypeRepository;
import org.openmetadata.service.ontology.RelationshipTypeIds;

final class RelationshipTypeSeedLoader {
  private static final String SEED_PATH = "json/data/ontology/relationshipTypes.json";
  private static final String SYSTEM_USER = "system";

  private RelationshipTypeSeedLoader() {}

  static void load(final RelationshipTypeRepository repository) throws IOException {
    final String json =
        CommonUtil.getResourceAsStream(
            RelationshipTypeSeedLoader.class.getClassLoader(), SEED_PATH);
    final RelationshipType[] seeds = JsonUtils.readValue(json, RelationshipType[].class);
    for (final RelationshipType seed : seeds) {
      createWhenMissing(repository, seed);
    }
  }

  private static void createWhenMissing(
      final RelationshipTypeRepository repository, final RelationshipType seed) {
    final RelationshipType existing = repository.findByNameOrNull(seed.getName(), Include.ALL);
    if (existing == null) {
      prepareSeed(seed);
      repository.create(null, seed);
    }
  }

  private static void prepareSeed(final RelationshipType seed) {
    seed.setId(RelationshipTypeIds.stableId(seed.getName()));
    seed.setFullyQualifiedName(seed.getName());
    seed.setUpdatedAt(System.currentTimeMillis());
    seed.setUpdatedBy(SYSTEM_USER);
  }
}
