/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

class UpdatedDomainsResourceContextTest {

  /** A stored resource whose every attribute is a fixed value. */
  private record StoredResource(
      List<EntityReference> owners,
      List<TagLabel> tags,
      Table entity,
      Set<String> loadedFields,
      List<EntityReference> domains,
      EntityReference service)
      implements ResourceContextInterface {

    @Override
    public String getResource() {
      return Entity.TABLE;
    }

    @Override
    public List<EntityReference> getOwners() {
      return owners;
    }

    @Override
    public List<TagLabel> getTags() {
      return tags;
    }

    @Override
    public EntityInterface<?> getEntity() {
      return entity;
    }

    @Override
    public EntityInterface<?> getResolvedEntity() {
      return entity;
    }

    @Override
    public Set<String> getLoadedFields() {
      return loadedFields;
    }

    @Override
    public List<EntityReference> getDomains() {
      return domains;
    }

    @Override
    public EntityReference getServiceReference() {
      return service;
    }
  }

  @Test
  void testReportsTheDomainsTheUpdateIsMovingInto() {
    final EntityReference targetDomain = domainRef();

    final ResourceContextInterface updated =
        new UpdatedDomainsResourceContext(storedIn(domainRef()), List.of(targetDomain));

    assertEquals(List.of(targetDomain), updated.getDomains());
  }

  /**
   * The second authorization pass must differ from the first only on domains. Otherwise a policy
   * condition such as isOwner() or matchAnyTag() could resolve differently and deny writes that have
   * nothing to do with a domain change.
   */
  @Test
  void testDelegatesEveryAttributeOtherThanDomains() {
    final StoredResource stored = storedIn(domainRef());

    final ResourceContextInterface updated =
        new UpdatedDomainsResourceContext(stored, List.of(domainRef()));

    assertEquals(Entity.TABLE, updated.getResource());
    assertSame(stored.owners(), updated.getOwners());
    assertSame(stored.tags(), updated.getTags());
    assertSame(stored.entity(), updated.getEntity());
    assertSame(stored.entity(), updated.getResolvedEntity());
    assertSame(stored.loadedFields(), updated.getLoadedFields());
    // A service entity is its own service, which the interface default cannot know.
    assertSame(stored.service(), updated.getServiceReference());
  }

  @Test
  void testClearingTheAssignmentReportsNoDomains() {
    final ResourceContextInterface updated =
        new UpdatedDomainsResourceContext(storedIn(domainRef()), List.of());

    assertTrue(updated.getDomains().isEmpty());
  }

  @Test
  void testTheDomainsCheckedCannotChangeAfterConstruction() {
    final EntityReference targetDomain = domainRef();
    final List<EntityReference> target = new ArrayList<>(List.of(targetDomain));

    final ResourceContextInterface updated =
        new UpdatedDomainsResourceContext(storedIn(domainRef()), target);
    target.add(domainRef());

    assertEquals(List.of(targetDomain), updated.getDomains());
    assertThrows(UnsupportedOperationException.class, () -> updated.getDomains().clear());
  }

  private static StoredResource storedIn(final EntityReference domain) {
    return new StoredResource(
        List.of(new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER)),
        List.of(new TagLabel().withTagFQN("PII.Sensitive")),
        new Table().withId(UUID.randomUUID()),
        Set.of(Entity.FIELD_TAGS),
        List.of(domain),
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.DATABASE_SERVICE));
  }

  private static EntityReference domainRef() {
    return new EntityReference().withId(UUID.randomUUID()).withType(Entity.DOMAIN);
  }
}
