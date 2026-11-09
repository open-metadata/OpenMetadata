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

package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import java.util.UUID;
import java.util.function.Predicate;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;

/** A memory a restricted copy also states never shows that copy while another document can. */
class MemorySourceDisclosureTest {
  private static final EntityReference PRIVATE_COPY = file("a-private-copy");
  private static final EntityReference ORIGINAL = file("b-original");
  private static final EntityReference OTHER_PRIVATE_COPY = file("c-private-copy");

  /** Everyone may read the original; the copies are shared with only some people. */
  private static final Predicate<EntityReference> ONLY_THE_ORIGINAL =
      document -> document.getId().equals(ORIGINAL.getId());

  @Test
  void theAnchorIsShownWhateverTheOthersAreNamed() {
    assertEquals(
        PRIVATE_COPY,
        MemorySourceDisclosure.shownSource(
            PRIVATE_COPY, List.of(PRIVATE_COPY, ORIGINAL), ONLY_THE_ORIGINAL));
    assertEquals(
        ORIGINAL,
        MemorySourceDisclosure.shownSource(
            ORIGINAL, List.of(PRIVATE_COPY, ORIGINAL), document -> false));
  }

  @Test
  void withoutItsAnchorADocumentEveryoneMayReadIsShownBeforeARestrictedCopy() {
    EntityReference elsewhere = file("an-asset-the-memory-is-anchored-to");

    assertEquals(
        ORIGINAL,
        MemorySourceDisclosure.shownSource(
            elsewhere, List.of(PRIVATE_COPY, ORIGINAL), ONLY_THE_ORIGINAL));
    assertEquals(
        ORIGINAL,
        MemorySourceDisclosure.shownSource(
            null, List.of(PRIVATE_COPY, ORIGINAL), ONLY_THE_ORIGINAL));
  }

  @Test
  void aRestrictedCopyIsShownOnlyWhenNoOtherDocumentCanBe() {
    assertEquals(
        PRIVATE_COPY,
        MemorySourceDisclosure.shownSource(
            null, List.of(PRIVATE_COPY, OTHER_PRIVATE_COPY), ONLY_THE_ORIGINAL));
  }

  /** A single document needs no choice, so nobody is asked who may read it. */
  @Test
  void aLoneDocumentIsShownWithoutAskingWhoMayReadIt() {
    Predicate<EntityReference> unasked =
        document -> {
          throw new AssertionError("asked who may read " + document.getName());
        };

    assertEquals(
        PRIVATE_COPY, MemorySourceDisclosure.shownSource(null, List.of(PRIVATE_COPY), unasked));
    assertNull(MemorySourceDisclosure.shownSource(ORIGINAL, List.of(), unasked));
  }

  /** The shown document is one the memory is linked to, never an anchor no link names. */
  @Test
  void anAnchorThatIsNoLinkedDocumentIsNeverShown() {
    assertEquals(
        PRIVATE_COPY,
        MemorySourceDisclosure.shownSource(
            OTHER_PRIVATE_COPY, List.of(PRIVATE_COPY, ORIGINAL), document -> false));
  }

  private static EntityReference file(String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(Entity.CONTEXT_FILE)
        .withName(name);
  }
}
