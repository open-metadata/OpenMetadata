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
package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.ServicesOverviewRepository.TypedKey;

/**
 * The merge is what makes a single name-sorted page out of one scan per service type, so paging over
 * it has to be gapless and duplicate-free. These cases run without a database.
 */
class ServicesOverviewMergeTest {

  private static TypedKey key(String entityType, String name) {
    return new TypedKey(entityType, name, UUID.nameUUIDFromBytes((entityType + name).getBytes()));
  }

  private static List<String> names(List<TypedKey> keys) {
    return keys.stream().map(TypedKey::name).toList();
  }

  @Test
  void interleavesTypesIntoOneGlobalNameOrder() {
    List<TypedKey> merged =
        ServicesOverviewRepository.merge(
            List.of(
                List.of(key("databaseService", "alpha"), key("databaseService", "mike")),
                List.of(key("dashboardService", "bravo"), key("dashboardService", "zulu")),
                List.of(key("apiService", "charlie"))),
            true);

    assertEquals(List.of("alpha", "bravo", "charlie", "mike", "zulu"), names(merged));
  }

  @Test
  void descendingIsTheExactReverse() {
    List<List<TypedKey>> input =
        List.of(
            List.of(key("databaseService", "alpha"), key("databaseService", "mike")),
            List.of(key("dashboardService", "bravo")));

    List<String> ascending = names(ServicesOverviewRepository.merge(input, true));
    List<String> descending = names(ServicesOverviewRepository.merge(input, false));

    assertEquals(ascending.reversed(), descending);
  }

  @Test
  void sameNameInTwoTypesIsBrokenDeterministicallyById() {
    TypedKey fromDatabase = key("databaseService", "shared");
    TypedKey fromDashboard = key("dashboardService", "shared");

    List<TypedKey> merged =
        ServicesOverviewRepository.merge(
            List.of(List.of(fromDatabase), List.of(fromDashboard)), true);
    List<TypedKey> reordered =
        ServicesOverviewRepository.merge(
            List.of(List.of(fromDashboard), List.of(fromDatabase)), true);

    assertEquals(2, merged.size());
    assertEquals(merged, reordered);
  }

  @Test
  void orderDoesNotDependOnNameCase() {
    List<TypedKey> merged =
        ServicesOverviewRepository.merge(
            List.of(
                List.of(key("databaseService", "Beta"), key("databaseService", "delta")),
                List.of(key("dashboardService", "alpha"), key("dashboardService", "Charlie"))),
            true);

    assertEquals(List.of("alpha", "Beta", "Charlie", "delta"), names(merged));
  }

  @Test
  void emptyAndSingleTypeInputsAreHandled() {
    assertEquals(List.of(), ServicesOverviewRepository.merge(List.of(), true));
    assertEquals(List.of(), ServicesOverviewRepository.merge(List.of(List.of()), true));
    assertEquals(
        List.of("only"),
        names(
            ServicesOverviewRepository.merge(
                List.of(List.of(key("databaseService", "only")), List.of()), true)));
  }

  @Test
  void pagingTheMergedListIsGaplessAndDuplicateFree() {
    List<List<TypedKey>> input = new ArrayList<>();
    for (String entityType : List.of("databaseService", "dashboardService", "apiService")) {
      List<TypedKey> perType = new ArrayList<>();
      for (int i = 0; i < 7; i++) {
        perType.add(key(entityType, String.format("%s-%02d", entityType, i)));
      }
      input.add(perType);
    }
    List<TypedKey> merged = ServicesOverviewRepository.merge(input, true);
    assertEquals(21, merged.size());

    for (int limit = 1; limit <= 21; limit++) {
      List<TypedKey> walked = new ArrayList<>();
      for (int offset = 0; offset < 21; offset += limit) {
        walked.addAll(ServicesOverviewRepository.slice(merged, offset, limit));
      }
      assertEquals(merged, walked, "walking every page with limit=" + limit);
    }
  }

  @Test
  void sliceClampsPastTheEndInsteadOfThrowing() {
    List<TypedKey> merged =
        ServicesOverviewRepository.merge(List.of(List.of(key("databaseService", "only"))), true);

    assertTrue(ServicesOverviewRepository.slice(merged, 5, 10).isEmpty());
    assertEquals(1, ServicesOverviewRepository.slice(merged, 0, 10).size());
  }

  @Test
  void keyScanLimitOnlyUnboundsWhenHealthIsFiltered() {
    ServicesOverviewRequest withoutHealth = request(java.util.Set.of());
    ServicesOverviewRequest withHealth =
        request(java.util.Set.of(org.openmetadata.schema.api.services.ServiceHealth.FAILED));

    assertEquals(60, withoutHealth.keyScanLimit());
    assertEquals(ServicesOverviewRequest.MAX_WINDOW, withHealth.keyScanLimit());
  }

  private ServicesOverviewRequest request(
      java.util.Set<org.openmetadata.schema.api.services.ServiceHealth> healths) {
    return new ServicesOverviewRequest(
        java.util.Set.of("databaseService"),
        java.util.Set.of("databaseService"),
        java.util.Set.of(),
        healths,
        null,
        !healths.isEmpty(),
        10,
        50,
        true,
        org.openmetadata.schema.type.Include.NON_DELETED,
        null,
        null);
  }
}
