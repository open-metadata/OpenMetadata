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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

/** Which domain lists a write's domain move is authorized against. */
class EntityRepositoryMoveTargetsTest {
  private final EntityReference domainA = domain("A");
  private final EntityReference domainB = domain("B");
  private final EntityReference domainC = domain("C");

  @Test
  void eachAddedDomainIsATargetOfItsOwn() {
    assertEquals(
        List.of(List.of(domainB), List.of(domainC)),
        EntityRepository.moveTargets(List.of(domainA), List.of(domainA, domainB, domainC)));
  }

  @Test
  void aMoveIsCheckedAgainstTheDomainItEnters() {
    assertEquals(
        List.of(List.of(domainB)),
        EntityRepository.moveTargets(List.of(domainA), List.of(domainB)));
  }

  @Test
  void anEntityWithoutDomainsIsCheckedForEachDomainItGets() {
    assertEquals(
        List.of(List.of(domainA), List.of(domainB)),
        EntityRepository.moveTargets(List.of(), List.of(domainA, domainB)));
  }

  @Test
  void aWriteThatOnlyRemovesIsCheckedAgainstTheDomainsItLeaves() {
    assertEquals(
        List.of(List.of(domainA)),
        EntityRepository.moveTargets(List.of(domainA, domainB), List.of(domainA)));
    assertEquals(List.of(List.of()), EntityRepository.moveTargets(List.of(domainA), List.of()));
  }

  @Test
  void aWriteThatKeepsTheDomainsNeedsNoCheck() {
    assertTrue(
        EntityRepository.moveTargets(List.of(domainA, domainB), List.of(domainB, domainA))
            .isEmpty());
    assertTrue(EntityRepository.moveTargets(List.of(), List.of()).isEmpty());
  }

  private static EntityReference domain(final String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.DOMAIN)
        .withName(name)
        .withFullyQualifiedName(name);
  }
}
