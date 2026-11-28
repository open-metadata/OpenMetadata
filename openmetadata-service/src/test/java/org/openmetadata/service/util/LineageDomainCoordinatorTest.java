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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/** The stripe a pair of ids locks must name a guard row the migration seeds. */
class LineageDomainCoordinatorTest {

  private static final Pattern SEEDED_ROW = Pattern.compile("(edge|pair)-(\\d{2})");

  @Test
  void everyStripeIsOneOfTheSeededRows() {
    for (int i = 0; i < 10_000; i++) {
      String stripe =
          LineageDomainCoordinator.stripe(
              LineageDomainCoordinator.PAIR_PREFIX, UUID.randomUUID(), UUID.randomUUID());
      var match = SEEDED_ROW.matcher(stripe);
      assertTrue(match.matches(), stripe);
      int index = Integer.parseInt(match.group(2));
      assertTrue(index >= 0 && index < LineageDomainCoordinator.STRIPES, stripe);
    }
  }

  @Test
  void thePairOfIdsAlwaysMapsToTheSameStripe() {
    UUID from = UUID.randomUUID();
    UUID to = UUID.randomUUID();

    assertEquals(
        LineageDomainCoordinator.stripe(LineageDomainCoordinator.EDGE_PREFIX, from, to),
        LineageDomainCoordinator.stripe(
            LineageDomainCoordinator.EDGE_PREFIX,
            UUID.fromString(from.toString()),
            UUID.fromString(to.toString())));
  }

  @Test
  void idsWhoseHashCodesCollideStillSpreadAcrossStripes() {
    UUID from = new UUID(0, 0);
    Set<String> stripes = new HashSet<>();
    for (long bits = 1; bits <= 256; bits++) {
      // Equal most and least significant bits give every one of these the hashCode 0.
      stripes.add(
          LineageDomainCoordinator.stripe(
              LineageDomainCoordinator.PAIR_PREFIX, from, new UUID(bits, bits)));
    }

    assertTrue(stripes.size() > LineageDomainCoordinator.STRIPES / 2, stripes.toString());
  }

  @Test
  void theDirectionOfAPairIsPartOfItsStripe() {
    int differing = 0;
    for (int i = 0; i < 100; i++) {
      UUID first = UUID.randomUUID();
      UUID second = UUID.randomUUID();
      if (!LineageDomainCoordinator.stripe("pair", first, second)
          .equals(LineageDomainCoordinator.stripe("pair", second, first))) {
        differing++;
      }
    }

    assertNotEquals(0, differing);
  }
}
