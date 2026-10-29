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

package org.openmetadata.service.resources.context;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.context.MemoryOutcomes;
import org.openmetadata.service.context.center.MemoryDerivations;
import org.openmetadata.service.search.SearchSortFilter;

class ContextMemoryResourceTest {

  private static final long NOW = 1_760_000_000_000L;
  private static final long SKEW = ContextMemoryResource.COUNTED_AT_CLOCK_SKEW.toMillis();

  @Test
  void aRecountMustSayWhenItCounted() {
    BadRequestException refused =
        assertThrows(
            BadRequestException.class,
            () -> ContextMemoryResource.requireRecountTime(new MemoryOutcomes(), NOW));

    assertEquals(ContextMemoryResource.COUNTED_AT_REQUIRED, refused.getMessage());
  }

  @Test
  void aRecountAheadOfTheServerClockIsRefused() {
    assertThrows(
        BadRequestException.class,
        () -> ContextMemoryResource.requireRecountTime(countedAt(NOW + SKEW + 1), NOW));
    assertThrows(
        BadRequestException.class,
        () -> ContextMemoryResource.requireRecountTime(countedAt(NOW * 1_000), NOW),
        "microseconds read as milliseconds");
  }

  @Test
  void aRecountInThePastOrWithinTheClockSkewIsAccepted() {
    assertDoesNotThrow(() -> ContextMemoryResource.requireRecountTime(countedAt(NOW - 1), NOW));
    assertDoesNotThrow(() -> ContextMemoryResource.requireRecountTime(countedAt(NOW + SKEW), NOW));
  }

  @Test
  void mostUsedBreaksAppliedCountTiesByRecordedUsage() {
    SearchSortFilter mostUsed = ContextMemoryResource.searchSort("appliedCount", "desc");

    assertEquals("outcomes.appliedCount", mostUsed.getSortField());
    assertEquals("usageCount", mostUsed.getThenSortField());
    assertNull(ContextMemoryResource.searchSort("updatedAt", "desc").getThenSortField());
  }

  @Test
  void derivationIdsAreCommaSeparatedUuidsWithinTheCap() {
    UUID first = UUID.randomUUID();
    UUID second = UUID.randomUUID();
    String tooMany =
        IntStream.rangeClosed(0, MemoryDerivations.MAX_ENTITIES)
            .mapToObj(i -> UUID.randomUUID().toString())
            .collect(Collectors.joining(","));

    assertEquals(
        List.of(first, second), ContextMemoryResource.parseDerivedIds(first + " , " + second));
    for (String invalid : Arrays.asList(null, "", "not-a-uuid", tooMany)) {
      assertThrows(BadRequestException.class, () -> ContextMemoryResource.parseDerivedIds(invalid));
    }
  }

  private static MemoryOutcomes countedAt(long countedAt) {
    return new MemoryOutcomes().withAppliedCount(3).withCountedAt(countedAt);
  }
}
