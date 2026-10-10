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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UpdatedDomainsResourceContextTest {
  @Mock private ResourceContextInterface storedResource;

  @Test
  void testReportsTheDomainsTheUpdateIsMovingInto() {
    EntityReference storedDomain = domainRef();
    EntityReference targetDomain = domainRef();
    when(storedResource.getDomains()).thenReturn(List.of(storedDomain));

    ResourceContextInterface updated =
        new UpdatedDomainsResourceContext(storedResource, List.of(targetDomain));

    assertEquals(List.of(targetDomain), updated.getDomains());
  }

  /**
   * The second authorization pass must differ from the first only on domains — otherwise a policy
   * condition such as isOwner() or matchAnyTag() could resolve differently and deny writes that have
   * nothing to do with a domain change.
   */
  @Test
  void testDelegatesEveryAttributeOtherThanDomains() {
    Table entity = new Table();
    List<EntityReference> owners = List.of(new EntityReference().withId(UUID.randomUUID()));
    List<TagLabel> tags = List.of(new TagLabel().withTagFQN("PII.Sensitive"));
    Set<String> loadedFields = Set.of(Entity.FIELD_TAGS);
    when(storedResource.getResource()).thenReturn(Entity.TABLE);
    when(storedResource.getOwners()).thenReturn(owners);
    when(storedResource.getTags()).thenReturn(tags);
    when(storedResource.getEntity()).thenReturn(entity);
    when(storedResource.getResolvedEntity()).thenReturn(entity);
    when(storedResource.getLoadedFields()).thenReturn(loadedFields);

    ResourceContextInterface updated =
        new UpdatedDomainsResourceContext(storedResource, List.of(domainRef()));

    assertEquals(Entity.TABLE, updated.getResource());
    assertSame(owners, updated.getOwners());
    assertSame(tags, updated.getTags());
    assertSame(entity, updated.getEntity());
    assertSame(entity, updated.getResolvedEntity());
    assertSame(loadedFields, updated.getLoadedFields());
  }

  @Test
  void testClearingTheAssignmentReportsNoDomains() {
    when(storedResource.getDomains()).thenReturn(List.of(domainRef()));

    ResourceContextInterface updated = new UpdatedDomainsResourceContext(storedResource, List.of());

    assertTrue(updated.getDomains().isEmpty());
  }

  private static EntityReference domainRef() {
    return new EntityReference().withId(UUID.randomUUID()).withType(Entity.DOMAIN);
  }
}
