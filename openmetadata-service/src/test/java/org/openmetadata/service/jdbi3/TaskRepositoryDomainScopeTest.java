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

import org.junit.jupiter.api.Test;

class TaskRepositoryDomainScopeTest {
  private static final String A = "11111111-1111-1111-1111-111111111111";
  private static final String B = "22222222-2222-2222-2222-222222222222";
  private static final String C = "33333333-3333-3333-3333-333333333333";

  @Test
  void aRequestedDomainWithItsSubDomainsIntersectsTheQuotedRoleScope() {
    // The requested ids come bare (a domain and its sub-domains); the role's scope comes quoted.
    assertEquals(A, TaskRepository.intersectDomainIds(A + "," + B, "'" + A + "','" + C + "'"));
  }

  @Test
  void quotedRequestedIdsStillIntersect() {
    assertEquals(A, TaskRepository.intersectDomainIds("'" + A + "'", "'" + A + "'"));
  }

  @Test
  void noOverlapOrNoScopeMatchesNothing() {
    assertEquals(ListFilter.NULL_PARAM, TaskRepository.intersectDomainIds(B, "'" + A + "'"));
    assertEquals(
        ListFilter.NULL_PARAM, TaskRepository.intersectDomainIds(A, ListFilter.NULL_PARAM));
  }
}
