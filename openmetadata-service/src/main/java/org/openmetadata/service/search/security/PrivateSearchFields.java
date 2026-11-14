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

package org.openmetadata.service.search.security;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.openmetadata.schema.search.AggregationRequest;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.sdk.exception.SearchException;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * How search treats the fields only admins and bots read. A user's email is masked on every other
 * read, so for anyone else a search that can reach user documents neither returns it nor matches
 * on it (ADR:2026-11-03-search-applies-the-same-access-rules-as-entity-reads). No subject means the
 * server searching for itself.
 */
public final class PrivateSearchFields {
  private static final String EMAIL = "email";
  private static final String ALL_INDICES = "_all";
  private static final String REFUSED =
      "Only admins and bots can search, sort or aggregate on user emails: this search names an"
          + " email field, searches every field, runs a script, or has a filter that is not plain"
          + " JSON";

  private PrivateSearchFields() {}

  public static boolean readsPrivateFields(SubjectContext subject) {
    return subject == null || subject.isAdmin() || subject.isBot();
  }

  /** Whether a search of {@code index} by {@code subject} may return and match private fields. */
  public static boolean matchesPrivateFields(SubjectContext subject, String index) {
    return readsPrivateFields(subject) || !targetsUserDocuments(index);
  }

  /** The source fields to leave out of the hits: those asked for, and what the caller may not read. */
  public static List<String> sourceExcludes(
      SubjectContext subject, String index, List<String> requested) {
    List<String> excludes = new ArrayList<>(listOrEmpty(requested));
    if (!matchesPrivateFields(subject, index) && !excludes.contains(EMAIL)) {
      excludes.add(EMAIL);
    }
    return Collections.unmodifiableList(excludes);
  }

  public static void refuseReferences(SubjectContext subject, SearchRequest request) {
    refuseReferences(subject, request.getIndex(), request);
  }

  /** Refuses a search of {@code index} whose query, filters or sort name a private field. */
  public static void refuseReferences(SubjectContext subject, String index, SearchRequest request) {
    if (!matchesPrivateFields(subject, index) && namesPrivateField(request)) {
      throw refused();
    }
  }

  /** Refuses an aggregation on, or scoped by a query naming, a private field. */
  public static void refuseReferences(SubjectContext subject, AggregationRequest request) {
    if (!matchesPrivateFields(subject, request.getIndex()) && namesPrivateField(request)) {
      throw refused();
    }
  }

  public static void refuseFieldReference(SubjectContext subject, String index, String field) {
    if (!matchesPrivateFields(subject, index) && PrivateFieldReferences.isPrivateField(field)) {
      throw refused();
    }
  }

  /** Whether query DSL the server wrote for {@code subject}, an NLQ translation, names one. */
  public static boolean namesPrivateField(SubjectContext subject, String index, String queryDsl) {
    return !matchesPrivateFields(subject, index) && PrivateFieldReferences.inQueryDsl(queryDsl);
  }

  private static boolean namesPrivateField(SearchRequest request) {
    return PrivateFieldReferences.inLuceneQuery(request.getQuery())
        || PrivateFieldReferences.inQueryDsl(request.getQueryFilter())
        || PrivateFieldReferences.inQueryDsl(request.getPostFilter())
        || PrivateFieldReferences.isPrivateField(request.getSortFieldParam());
  }

  // The aggregation managers read a query starting with '{' as DSL and any other as Lucene.
  private static boolean namesPrivateField(AggregationRequest request) {
    String query = request.getQuery();
    boolean queryNamesOne =
        query != null && query.trim().startsWith("{")
            ? PrivateFieldReferences.inQueryDsl(query)
            : PrivateFieldReferences.inLuceneQuery(query);
    return queryNamesOne
        || PrivateFieldReferences.isPrivateField(request.getFieldName())
        || PrivateFieldReferences.inLuceneQuery(request.getQueryText());
  }

  private static SearchException refused() {
    return SearchException.withStatus(Response.Status.BAD_REQUEST, REFUSED);
  }

  /** Whether {@code index} can reach user documents; naming no index searches every index. */
  static boolean targetsUserDocuments(String index) {
    SearchRepository repository = Entity.getSearchRepository();
    IndexMapping users = repository == null ? null : repository.getIndexMapping(Entity.USER);
    return users != null
        && (nullOrEmpty(index)
            || reaches(
                Objects.requireNonNullElse(repository.getIndexOrAliasName(index), index),
                namesOf(users),
                repository.getClusterAlias()));
  }

  private static Set<String> namesOf(IndexMapping mapping) {
    Set<String> names = new HashSet<>(listOrEmpty(mapping.getParentAliases()));
    names.addAll(listOrEmpty(mapping.getChildAliases()));
    names.add(Entity.USER);
    names.add(mapping.getIndexName());
    names.add(mapping.getAlias());
    names.remove(null);
    return names;
  }

  /**
   * Whether an index expression, resolved to index names, reaches one of {@code names}, which
   * carry no cluster prefix. A wildcard reaches every name it matches; an exclusion is ignored, so
   * the answer errs towards reaching.
   */
  static boolean reaches(String resolvedIndex, Set<String> names, String clusterAlias) {
    return Arrays.stream(resolvedIndex.split(","))
        .map(String::trim)
        .filter(token -> !token.isEmpty() && !token.startsWith("-"))
        .map(
            token ->
                withoutClusterPrefix(token.substring(token.lastIndexOf(':') + 1), clusterAlias))
        .anyMatch(
            name ->
                ALL_INDICES.equals(name)
                    || names.stream()
                        .anyMatch(known -> PrivateFieldReferences.matchesPattern(name, known)));
  }

  private static String withoutClusterPrefix(String token, String clusterAlias) {
    String prefix =
        nullOrEmpty(clusterAlias) ? "" : clusterAlias + IndexMapping.INDEX_NAME_SEPARATOR;
    return !prefix.isEmpty() && token.startsWith(prefix) ? token.substring(prefix.length()) : token;
  }
}
