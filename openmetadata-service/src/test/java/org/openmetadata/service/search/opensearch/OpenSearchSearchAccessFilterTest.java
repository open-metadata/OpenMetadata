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
package org.openmetadata.service.search.opensearch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilderFactory;
import org.openmetadata.service.search.security.RBACConditionEvaluator;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.util.EntityUtil;

/**
 * The search access filter a hybrid search carries: the clause keyword search ANDs into its query
 * for the same caller, or none for a caller keyword search does not filter.
 */
class OpenSearchSearchAccessFilterTest {

  private static final UUID DOMAIN_ID = UUID.randomUUID();
  private static SearchSettings accessControlOn;
  private static SearchSettings accessControlOff;

  private final RBACConditionEvaluator evaluator =
      new RBACConditionEvaluator(new OpenSearchQueryBuilderFactory());
  private MockedStatic<Entity> entity;
  private MockedStatic<SettingsCache> settings;

  @BeforeAll
  static void loadShippedSearchSettings() throws Exception {
    final List<String> files =
        EntityUtil.getJsonDataResources(".*json/data/settings/searchSettings.json$");
    final String json =
        CommonUtil.getResourceAsStream(EntityRepository.class.getClassLoader(), files.getFirst());
    accessControlOff = JsonUtils.readValue(json, SearchSettings.class);
    accessControlOn = JsonUtils.readValue(json, SearchSettings.class);
    accessControlOn.getGlobalSettings().setEnableAccessControl(true);
  }

  @BeforeEach
  void setUp() {
    final SearchRepository repository = mock(SearchRepository.class);
    when(repository.getIndexOrAliasName(anyString())).thenAnswer(i -> i.getArgument(0));
    entity = mockStatic(Entity.class);
    entity.when(Entity::getSearchRepository).thenReturn(repository);
    settings = mockStatic(SettingsCache.class);
    searchAccessControl(accessControlOn);
  }

  @AfterEach
  void tearDown() {
    settings.close();
    entity.close();
  }

  private void searchAccessControl(final SearchSettings searchSettings) {
    settings
        .when(() -> SettingsCache.getSetting(SettingsType.SEARCH_SETTINGS, SearchSettings.class))
        .thenReturn(searchSettings);
  }

  @Test
  void aCallerWhoseSearchIsFilteredGetsTheClauseOfTheirOwnPolicies() {
    final SubjectContext caller = RbacTestSubjects.domainScoped(false, DOMAIN_ID);

    assertThat(OpenSearchRbacQueries.accessFilter(caller, evaluator))
        .hasValueSatisfying(
            filter -> assertThat(filter).contains("domains.id", DOMAIN_ID.toString()));
  }

  @Test
  void anAdminANullCallerAndSearchWithoutAccessControlNeedNoFilter() {
    assertThat(
            OpenSearchRbacQueries.accessFilter(
                RbacTestSubjects.domainScoped(true, DOMAIN_ID), evaluator))
        .isEmpty();
    assertThat(OpenSearchRbacQueries.accessFilter(null, evaluator)).isEmpty();
    searchAccessControl(accessControlOff);
    assertThat(
            OpenSearchRbacQueries.accessFilter(
                RbacTestSubjects.domainScoped(false, DOMAIN_ID), evaluator))
        .isEmpty();
  }

  @Test
  void aCallerWhosePoliciesAllowNothingMatchesNothing() {
    final RBACConditionEvaluator allowsNothing = mock(RBACConditionEvaluator.class);
    when(allowsNothing.evaluateConditions(any(SubjectContext.class))).thenReturn(null);

    assertThat(
            OpenSearchRbacQueries.accessFilter(
                RbacTestSubjects.domainScoped(false, DOMAIN_ID), allowsNothing))
        .hasValueSatisfying(filter -> assertThat(filter).contains("match_none"));
  }
}
