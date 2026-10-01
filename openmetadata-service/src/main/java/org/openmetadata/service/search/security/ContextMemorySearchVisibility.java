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
import java.util.Map;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.indexes.ContextMemoryIndex;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Builds a search-time filter that hides {@link
 * org.openmetadata.schema.entity.context.ContextMemory} documents a subject is not allowed to see,
 * while leaving every other entity type untouched. The filter is ANDed into global search and
 * search-backed listings so they enforce {@code shareConfig} privacy and the conservative anchor
 * rule described below (see {@link
 * org.openmetadata.service.resources.context.ContextMemoryVisibility#isVisibleToUser}).
 *
 * <p>Memory visibility is driven by the per-memory shareConfig, not by the OSS RBAC/policy model,
 * so it is applied for every non-admin subject regardless of the RBAC access-control toggle.
 * Disabling RBAC search filtering must never expose another user's private memories.
 *
 * <p>Every memory is indexed, whatever its visibility, so that owners and shared principals keep
 * finding their own restricted memories through the search-backed {@code /contextCenter/memories}
 * listing and global search. That makes this filter the sole enforcement point on the search side:
 * every path that can return a ContextMemory document to a caller must apply it.
 *
 * <p>The produced query is engine-agnostic via {@link QueryBuilderFactory}, so the same builder
 * serves both Elasticsearch and OpenSearch. Each OR-group is a bool with only {@code should}
 * clauses so the engine default {@code minimum_should_match = 1} applies (the {@link OMQueryBuilder}
 * abstraction exposes no way to set it explicitly).
 *
 * <p><b>A new visibility predicate needs three edits.</b> This class renders the rule as {@link
 * OMQueryBuilder} clauses; {@link org.openmetadata.service.search.vector.VectorSearchQueryBuilder}
 * renders it as raw JSON (it serves both engines from a {@code StringBuilder}); {@link
 * org.openmetadata.service.resources.context.ContextMemoryVisibility#isVisibleToUser} decides it
 * in-memory for the REST read paths. Normal search additionally requires Active status; direct
 * REST reads can still inspect a retired memory and its history.
 *
 * <p>Search cannot evaluate an anchor's policy per document. An anchored memory is
 * therefore searchable only by its owners and admins. An explicit unanchored marker is required:
 * old documents without the marker stay hidden from non-owners until reindexed.
 */
public class ContextMemorySearchVisibility {

  public static final String FIELD_ENTITY_TYPE = "entityType";
  public static final String FIELD_VISIBILITY = "visibility";
  public static final String FIELD_OWNERS = "owners";
  public static final String FIELD_OWNERS_ID = "owners.id";
  public static final String FIELD_SHARED_WITH_IDS = "sharedWithIds";

  private final QueryBuilderFactory queryBuilderFactory;

  public ContextMemorySearchVisibility(QueryBuilderFactory queryBuilderFactory) {
    this.queryBuilderFactory = queryBuilderFactory;
  }

  /**
   * Returns a filter constraining context memory documents to Active memories visible to the
   * subject. Admins bypass visibility but still get the Active constraint. A missing subject
   * returns {@code null} so the caller can apply the org-wide fallback.
   */
  public OMQueryBuilder buildVisibilityFilter(SubjectContext subjectContext) {
    return buildVisibilityFilter(subjectContext, List.of(ContextMemoryStatus.ACTIVE));
  }

  /** Status-aware visibility is used only by the authenticated Context Center list endpoint. */
  public OMQueryBuilder buildVisibilityFilter(
      SubjectContext subjectContext, List<ContextMemoryStatus> statuses) {
    OMQueryBuilder filter = null;
    if (isVisibilityEnforced(subjectContext)) {
      filter = scopeMemoriesTo(buildVisibleToUserClause(subjectContext.user()), statuses);
    } else if (isSubjectResolvable(subjectContext)) {
      filter = scopeMemoriesTo(null, statuses);
    }
    return filter;
  }

  /**
   * Returns a filter admitting only Active, unanchored Entity or Public memories.
   * This is the fail-closed default for search paths without a {@link SubjectContext}. Like {@link
   * #buildVisibilityFilter}, non-memory documents always pass.
   */
  public OMQueryBuilder buildOrgWideOnlyFilter() {
    return scopeMemoriesTo(unanchoredOrgWideClause());
  }

  /**
   * The document-level equivalent of {@link #buildOrgWideOnlyFilter}, for fetch-by-id paths that
   * run no query to filter. Returns false for restricted, anchored, or retired context memories;
   * every other document passes.
   */
  public static boolean isOrgWideReadable(Map<String, Object> document) {
    boolean readable = true;
    if (document != null && Entity.CONTEXT_MEMORY.equals(document.get(FIELD_ENTITY_TYPE))) {
      readable =
          (MemoryVisibility.ENTITY.value().equals(document.get(FIELD_VISIBILITY))
                  || MemoryVisibility.PUBLIC.value().equals(document.get(FIELD_VISIBILITY)))
              && ContextMemoryStatus.ACTIVE
                  .value()
                  .equals(document.get(ContextMemoryIndex.FIELD_STATUS))
              && ContextMemoryIndex.UNANCHORED.equals(
                  document.get(ContextMemoryIndex.FIELD_ANCHOR_ID));
    }
    return readable;
  }

  /**
   * Whether the subject is identifiable enough to decide memory visibility from. Only then may a
   * caller mark the request as resolved; an unidentifiable subject must fall back to the
   * org-wide-only default rather than search unfiltered.
   */
  public boolean isSubjectResolvable(SubjectContext subjectContext) {
    return subjectContext != null
        && subjectContext.user() != null
        && subjectContext.user().getId() != null;
  }

  /**
   * Whether this subject needs a visibility clause: identifiable, and not an admin. Public
   * so the raw-JSON rendering in {@link
   * org.openmetadata.service.search.vector.VectorSearchQueryBuilder} decides from the same predicate
   * instead of re-deriving it.
   */
  public boolean isVisibilityEnforced(SubjectContext subjectContext) {
    return isSubjectResolvable(subjectContext) && !subjectContext.isAdmin();
  }

  /** Applies the Active constraint and optional visibility clause only to context memories. */
  private OMQueryBuilder scopeMemoriesTo(OMQueryBuilder memoryClause) {
    return scopeMemoriesTo(memoryClause, List.of(ContextMemoryStatus.ACTIVE));
  }

  private OMQueryBuilder scopeMemoriesTo(
      OMQueryBuilder memoryClause, List<ContextMemoryStatus> statuses) {
    OMQueryBuilder nonMemory =
        queryBuilderFactory
            .boolQuery()
            .mustNot(
                List.of(queryBuilderFactory.termQuery(FIELD_ENTITY_TYPE, Entity.CONTEXT_MEMORY)));
    List<OMQueryBuilder> clauses = new ArrayList<>();
    clauses.add(queryBuilderFactory.termQuery(FIELD_ENTITY_TYPE, Entity.CONTEXT_MEMORY));
    if (memoryClause != null) {
      clauses.add(memoryClause);
    }
    clauses.add(
        statuses.size() == 1
            ? queryBuilderFactory.termQuery(
                ContextMemoryIndex.FIELD_STATUS, statuses.getFirst().value())
            : queryBuilderFactory.termsQuery(
                ContextMemoryIndex.FIELD_STATUS,
                statuses.stream().map(ContextMemoryStatus::value).toList()));
    OMQueryBuilder memoryVisible = queryBuilderFactory.boolQuery().must(clauses);
    return queryBuilderFactory.boolQuery().should(List.of(nonMemory, memoryVisible));
  }

  private OMQueryBuilder buildVisibleToUserClause(User user) {
    List<OMQueryBuilder> clauses = new ArrayList<>();
    clauses.add(unanchoredOrgWideClause());
    clauses.add(
        queryBuilderFactory.nestedQuery(
            FIELD_OWNERS, queryBuilderFactory.termQuery(FIELD_OWNERS_ID, user.getId().toString())));
    clauses.add(sharedWithSubjectClause(user));
    return queryBuilderFactory.boolQuery().should(clauses);
  }

  private OMQueryBuilder unanchoredOrgWideClause() {
    return queryBuilderFactory
        .boolQuery()
        .must(
            List.of(
                queryBuilderFactory
                    .boolQuery()
                    .should(
                        List.of(
                            queryBuilderFactory.termQuery(
                                FIELD_VISIBILITY, MemoryVisibility.ENTITY.value()),
                            queryBuilderFactory.termQuery(
                                FIELD_VISIBILITY, MemoryVisibility.PUBLIC.value()))),
                queryBuilderFactory.termQuery(
                    ContextMemoryIndex.FIELD_ANCHOR_ID, ContextMemoryIndex.UNANCHORED)));
  }

  /**
   * Matches a memory shared with the subject (directly or via a team/domain) — but only when its
   * visibility is actually {@code Shared}. Gating on visibility mirrors {@link
   * org.openmetadata.service.resources.context.ContextMemoryVisibility#isInSharedWithList}, which
   * is consulted only for {@code SHARED}, so a stale {@code sharedWithIds} left on a memory later
   * flipped to {@code Private} cannot leak it to those principals through search.
   */
  private OMQueryBuilder sharedWithSubjectClause(User user) {
    return queryBuilderFactory
        .boolQuery()
        .must(
            List.of(
                queryBuilderFactory.termQuery(FIELD_VISIBILITY, MemoryVisibility.SHARED.value()),
                queryBuilderFactory.termsQuery(FIELD_SHARED_WITH_IDS, sharedPrincipalIds(user))));
  }

  /**
   * The principals a {@code Shared} memory may name to reach this user: the user, their teams and
   * their domains. Public and static so every rendering of the rule derives the same set — see the
   * class doc on the two renderings.
   */
  public static List<String> sharedPrincipalIds(User user) {
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
