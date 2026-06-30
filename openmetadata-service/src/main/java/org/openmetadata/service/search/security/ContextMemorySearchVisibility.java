/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.search.security;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Builds a search-time filter that hides {@link
 * org.openmetadata.schema.entity.context.ContextMemory} documents a subject is not allowed to see,
 * while leaving every other entity type untouched. The filter is ANDed into global search and
 * search-backed listings so they enforce the same per-memory {@code shareConfig} privacy as the
 * REST read endpoints (see {@link
 * org.openmetadata.service.resources.context.ContextMemoryVisibility#isVisibleToUser}).
 *
 * <p>Memory visibility is driven by the per-memory shareConfig, not by the OSS RBAC/policy model,
 * so it is applied for every non-admin subject regardless of the RBAC access-control toggle.
 * Disabling RBAC search filtering must never expose another user's private memories.
 *
 * <p>The produced query is engine-agnostic via {@link QueryBuilderFactory}, so the same builder
 * serves both Elasticsearch and OpenSearch. Each OR-group is a bool with only {@code should}
 * clauses so the engine default {@code minimum_should_match = 1} applies (the {@link OMQueryBuilder}
 * abstraction exposes no way to set it explicitly).
 */
public class ContextMemorySearchVisibility {

  static final String FIELD_ENTITY_TYPE = "entityType";
  static final String FIELD_VISIBILITY = "visibility";
  static final String FIELD_OWNERS = "owners";
  static final String FIELD_OWNERS_ID = "owners.id";
  static final String FIELD_SHARED_WITH_IDS = "sharedWithIds";

  private final QueryBuilderFactory queryBuilderFactory;

  public ContextMemorySearchVisibility(QueryBuilderFactory queryBuilderFactory) {
    this.queryBuilderFactory = queryBuilderFactory;
  }

  /**
   * Returns a filter constraining context memory documents to those visible to the subject, or
   * {@code null} when no restriction is needed (admins, or a missing/unidentifiable subject). The
   * filter is safe to AND into any search: non-memory documents always pass.
   */
  public OMQueryBuilder buildVisibilityFilter(SubjectContext subjectContext) {
    OMQueryBuilder filter = null;
    if (isVisibilityEnforced(subjectContext)) {
      filter = buildFilter(subjectContext.user());
    }
    return filter;
  }

  private boolean isVisibilityEnforced(SubjectContext subjectContext) {
    return subjectContext != null
        && !subjectContext.isAdmin()
        && subjectContext.user() != null
        && subjectContext.user().getId() != null;
  }

  private OMQueryBuilder buildFilter(User user) {
    OMQueryBuilder nonMemory =
        queryBuilderFactory
            .boolQuery()
            .mustNot(
                List.of(queryBuilderFactory.termQuery(FIELD_ENTITY_TYPE, Entity.CONTEXT_MEMORY)));
    OMQueryBuilder memoryVisible =
        queryBuilderFactory
            .boolQuery()
            .must(
                List.of(
                    queryBuilderFactory.termQuery(FIELD_ENTITY_TYPE, Entity.CONTEXT_MEMORY),
                    buildVisibleToUserClause(user)));
    return queryBuilderFactory.boolQuery().should(List.of(nonMemory, memoryVisible));
  }

  private OMQueryBuilder buildVisibleToUserClause(User user) {
    List<OMQueryBuilder> clauses = new ArrayList<>();
    clauses.add(queryBuilderFactory.termQuery(FIELD_VISIBILITY, MemoryVisibility.ENTITY.value()));
    clauses.add(
        queryBuilderFactory.nestedQuery(
            FIELD_OWNERS, queryBuilderFactory.termQuery(FIELD_OWNERS_ID, user.getId().toString())));
    clauses.add(sharedWithSubjectClause(user));
    return queryBuilderFactory.boolQuery().should(clauses);
  }

  /**
   * Matches a memory shared with the subject (directly or via a team/domain) — but only when its
   * visibility is actually {@code Shared}. Gating on visibility mirrors {@link
   * org.openmetadata.service.resources.context.ContextMemoryVisibility#isInSharedWithList}, which is
   * consulted only for {@code SHARED}, so a stale {@code sharedWithIds} left on a memory later flipped
   * to {@code Private} cannot leak it to those principals through search.
   */
  private OMQueryBuilder sharedWithSubjectClause(User user) {
    return queryBuilderFactory
        .boolQuery()
        .must(
            List.of(
                queryBuilderFactory.termQuery(FIELD_VISIBILITY, MemoryVisibility.SHARED.value()),
                queryBuilderFactory.termsQuery(FIELD_SHARED_WITH_IDS, sharedPrincipalIds(user))));
  }

  private List<String> sharedPrincipalIds(User user) {
    List<String> principalIds = new ArrayList<>();
    principalIds.add(user.getId().toString());
    for (EntityReference team : listOrEmpty(user.getTeams())) {
      principalIds.add(team.getId().toString());
    }
    for (EntityReference domain : listOrEmpty(user.getDomains())) {
      principalIds.add(domain.getId().toString());
    }
    return principalIds;
  }
}
