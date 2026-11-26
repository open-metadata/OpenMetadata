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

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;
import org.jdbi.v3.core.Jdbi;
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
  private final Jdbi jdbi = Entity.getJdbi();
  private final CollectionDAO collectionDAO = Entity.getCollectionDAO();
  private final SystemRepository systemRepository = Entity.getSystemRepository();
  private final EntityRelationshipRepository relationships =
      Entity.getEntityRelationshipRepository();
  private final Map<String, EntityRepository<?>> repositories = registeredRepositories();
  private final Map<String, EntityRepository<?>> previousRepositories = new HashMap<>(repositories);

  public static EntityRegistrySnapshot capture() {
    return new EntityRegistrySnapshot();
  }

  public void restore() {
    Entity.setJdbi(jdbi);
    Entity.setCollectionDAO(collectionDAO);
    Entity.setSystemRepository(systemRepository);
    Entity.setEntityRelationshipRepository(relationships);
    repositories.clear();
    repositories.putAll(previousRepositories);
  }

  @SuppressWarnings("unchecked")
  static Map<String, EntityRepository<?>> registeredRepositories() {
    try {
      Field registry = Entity.class.getDeclaredField("ENTITY_REPOSITORY_MAP");
      registry.setAccessible(true);
      return (Map<String, EntityRepository<?>>) registry.get(null);
    } catch (ReflectiveOperationException e) {
      throw new AssertionError("Cannot preserve ontology fixture repositories", e);
    }
  }
}
