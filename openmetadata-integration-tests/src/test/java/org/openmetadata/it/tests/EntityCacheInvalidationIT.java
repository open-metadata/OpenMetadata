/*
 *  Copyright 2024 Collate
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
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.UUID;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.RequestEntityCache;

/**
 * Tests that the Guava entity cache (CACHE_WITH_ID / CACHE_WITH_NAME) is properly invalidated
 * after entity updates. Without proper invalidation, internal calls to Entity.getEntity() with
 * fromCache=true would return stale data after PUT/PATCH operations.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
class EntityCacheInvalidationIT {

  @Test
  void testCacheInvalidatedAfterUpdate_byId(TestNamespace ns) {
    Domain domain = createDomain(ns, "cacheById", "original description");
    UUID domainId = domain.getId();

    // Populate the Guava cache by reading with fromCache=true
    Domain cached = Entity.getEntity(Entity.DOMAIN, domainId, "", Include.NON_DELETED, true);
    assertEquals("original description", cached.getDescription());

    // Update via REST API (goes through EntityRepository.storeNewVersion)
    domain.setDescription("updated description");
    SdkClients.adminClient().domains().update(domainId.toString(), domain);

    // Clear the test thread's RequestEntityCache to simulate a new HTTP request context.
    // In production, each request starts with a fresh RequestEntityCache.
    RequestEntityCache.clear();

    // Read again with fromCache=true — should get the updated value, not stale cache
    Domain afterUpdate = Entity.getEntity(Entity.DOMAIN, domainId, "", Include.NON_DELETED, true);
    assertEquals(
        "updated description",
        afterUpdate.getDescription(),
        "CACHE_WITH_ID should be invalidated after entity update");
  }

  @Test
  void testCacheInvalidatedAfterUpdate_byName(TestNamespace ns) {
    Domain domain = createDomain(ns, "cacheByName", "original description");
    String fqn = domain.getFullyQualifiedName();

    // Populate the Guava cache by reading with fromCache=true
    Domain cached = Entity.getEntityByName(Entity.DOMAIN, fqn, "", Include.NON_DELETED, true);
    assertEquals("original description", cached.getDescription());

    // Update via REST API
    domain.setDescription("updated description");
    SdkClients.adminClient().domains().update(domain.getId().toString(), domain);

    RequestEntityCache.clear();

    // Read again with fromCache=true — should get the updated value
    Domain afterUpdate = Entity.getEntityByName(Entity.DOMAIN, fqn, "", Include.NON_DELETED, true);
    assertEquals(
        "updated description",
        afterUpdate.getDescription(),
        "CACHE_WITH_NAME should be invalidated after entity update");
  }

  @Test
  void testCrossEntityReadAfterUpdate(TestNamespace ns) {
    // This simulates the real-world bug: update entity A, then read entity B which
    // internally reads entity A from cache and gets stale data.
    Domain parent = createDomain(ns, "parent", "parent domain");
    UUID parentId = parent.getId();

    // Populate cache
    Domain cachedParent = Entity.getEntity(Entity.DOMAIN, parentId, "", Include.NON_DELETED, true);
    assertEquals("parent domain", cachedParent.getDescription());

    // Update parent via REST API
    parent.setDescription("parent domain - updated");
    SdkClients.adminClient().domains().update(parentId.toString(), parent);

    RequestEntityCache.clear();

    // Simulate a cross-entity read: another entity's setFields() calls
    // Entity.getEntity(parentRef, ...) with default fromCache=true.
    // This must return the updated data.
    Domain freshParent = Entity.getEntity(Entity.DOMAIN, parentId, "", Include.NON_DELETED, true);
    assertEquals(
        "parent domain - updated",
        freshParent.getDescription(),
        "Cross-entity reads via Entity.getEntity() must see updates");
  }

  @Test
  void testGuavaCacheEntryRemovedAfterUpdate(TestNamespace ns) throws Exception {
    Domain domain = createDomain(ns, "cacheEntry", "before update");
    UUID domainId = domain.getId();

    // Force a cache load
    EntityRepository.CACHE_WITH_ID.get(new ImmutablePair<>(Entity.DOMAIN, domainId));

    // Verify cache has the entity
    String cachedJson =
        EntityRepository.CACHE_WITH_ID.getIfPresent(new ImmutablePair<>(Entity.DOMAIN, domainId));
    assertNotNull(cachedJson, "Cache should contain the entity after get()");
    Domain cachedEntity = JsonUtils.readValue(cachedJson, Domain.class);
    assertEquals("before update", cachedEntity.getDescription());

    // Update via REST API
    domain.setDescription("after update");
    SdkClients.adminClient().domains().update(domainId.toString(), domain);

    // After update, re-loading from cache should get fresh data
    String freshJson =
        EntityRepository.CACHE_WITH_ID.get(new ImmutablePair<>(Entity.DOMAIN, domainId));
    Domain freshEntity = JsonUtils.readValue(freshJson, Domain.class);
    assertEquals(
        "after update",
        freshEntity.getDescription(),
        "Guava cache should return fresh data after entity update");
  }

  private Domain createDomain(TestNamespace ns, String suffix, String description) {
    CreateDomain request =
        new CreateDomain()
            .withName(ns.prefix(suffix))
            .withDomainType(DomainType.AGGREGATE)
            .withDescription(description);
    return SdkClients.adminClient().domains().create(request);
  }
}
