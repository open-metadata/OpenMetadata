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
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.Entity;

class TaskRepositoryDomainFilterTest {
  private static final String DOMAIN_ID = "domainId";
  private static final String REQUESTED_DOMAIN_ID = "requestedDomainId";
  private static final String DOMAIN_ACCESS_CONTROL = "domainAccessControl";
  private static final String ENTITY_TYPE = "entityType";
  private static final String FINANCE_DOMAIN_ID = "'11111111-1111-1111-1111-111111111111'";
  private static final String MARKETING_DOMAIN_ID = "'22222222-2222-2222-2222-222222222222'";
  private static final String NO_MATCH_DOMAIN_ID = "'00000000-0000-0000-0000-000000000000'";

  private final TaskRepository repository = mock(TaskRepository.class, CALLS_REAL_METHODS);

  @Test
  void unrestrictedUserCanRequestADomain() {
    ListFilter filter = new ListFilter();
    filter.addQueryParam(REQUESTED_DOMAIN_ID, FINANCE_DOMAIN_ID);

    repository.applyTaskDomainFilter(filter);

    assertEquals(FINANCE_DOMAIN_ID, filter.getQueryParam(DOMAIN_ID));
  }

  @Test
  void restrictedUserCanRequestTheirOwnDomain() {
    ListFilter filter = restrictedUserFilter(MARKETING_DOMAIN_ID);
    filter.addQueryParam(REQUESTED_DOMAIN_ID, MARKETING_DOMAIN_ID);

    repository.applyTaskDomainFilter(filter);

    assertEquals(MARKETING_DOMAIN_ID, filter.getQueryParam(DOMAIN_ID));
  }

  @Test
  void restrictedUserCannotRequestAnotherDomain() {
    ListFilter filter = restrictedUserFilter(MARKETING_DOMAIN_ID);
    filter.addQueryParam(REQUESTED_DOMAIN_ID, FINANCE_DOMAIN_ID);

    repository.applyTaskDomainFilter(filter);

    assertEquals(NO_MATCH_DOMAIN_ID, filter.getQueryParam(DOMAIN_ID));
  }

  @Test
  void restrictedUserWithoutDomainsGetsNoMatches() {
    ListFilter filter = domainLessRestrictedUserFilter();

    repository.applyTaskDomainFilter(filter);

    assertEquals(NO_MATCH_DOMAIN_ID, filter.getQueryParam(DOMAIN_ID));
  }

  @Test
  void restrictedUserWithoutDomainsCannotRequestADomain() {
    ListFilter filter = domainLessRestrictedUserFilter();
    filter.addQueryParam(REQUESTED_DOMAIN_ID, FINANCE_DOMAIN_ID);

    repository.applyTaskDomainFilter(filter);

    assertEquals(NO_MATCH_DOMAIN_ID, filter.getQueryParam(DOMAIN_ID));
  }

  private static ListFilter restrictedUserFilter(String allowedDomainId) {
    ListFilter filter = new ListFilter();
    filter.addQueryParam(DOMAIN_ID, allowedDomainId);
    filter.addQueryParam(DOMAIN_ACCESS_CONTROL, "true");
    return filter;
  }

  private static ListFilter domainLessRestrictedUserFilter() {
    ListFilter filter = new ListFilter();
    filter.addQueryParam(DOMAIN_ID, ListFilter.NULL_PARAM);
    filter.addQueryParam(ENTITY_TYPE, Entity.TASK);
    return filter;
  }
}
