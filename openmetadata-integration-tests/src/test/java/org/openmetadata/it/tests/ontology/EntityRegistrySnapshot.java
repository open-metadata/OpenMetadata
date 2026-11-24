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

package org.openmetadata.it.tests.ontology;

import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRelationshipRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.SystemRepository;

/**
 * The static {@link Entity} state a test replaces to run repositories against a scratch database.
 * The suite's server registered the originals, so restoring them keeps later tests on the real
 * database; constructing a repository re-registers it and would otherwise leave a dropped one.
 */
public final class EntityRegistrySnapshot {
  private final CollectionDAO collectionDAO = Entity.getCollectionDAO();
  private final SystemRepository systemRepository = Entity.getSystemRepository();
  private final EntityRelationshipRepository relationships =
      Entity.getEntityRelationshipRepository();
  private final List<EntityRepository<? extends EntityInterface<?>>> repositories =
      List.copyOf(Entity.getEntityRepositories());

  public static EntityRegistrySnapshot capture() {
    return new EntityRegistrySnapshot();
  }

  public void restore() {
    Entity.setCollectionDAO(collectionDAO);
    Entity.setSystemRepository(systemRepository);
    Entity.setEntityRelationshipRepository(relationships);
    repositories.forEach(EntityRegistrySnapshot::register);
  }

  @SuppressWarnings({"unchecked", "rawtypes"})
  private static void register(EntityRepository repository) {
    Entity.registerEntity(repository.getEntityClass(), repository.getEntityType(), repository);
  }
}
