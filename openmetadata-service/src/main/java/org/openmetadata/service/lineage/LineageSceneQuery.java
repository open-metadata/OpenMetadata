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
package org.openmetadata.service.lineage;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.lineage.LineageDomainFilter;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Builds the Elasticsearch/OpenSearch query bodies the lineage scene resolver sends to
 * {@code SearchRepository}.
 *
 * <p>Those APIs take the query as a JSON string, and this class is shared by both the ES and the OS
 * stack, so it cannot use either client's typed builders — those live behind the {@code es.*} /
 * {@code os.*} relocations in {@code openmetadata-shaded-deps} and picking one would break the
 * other. The clause helpers below exist so call sites read as query intent rather than as nested
 * {@code Map.of} literals, which is what made the previous inline form hard to review and debug.
 * {@code PersonaContextBuilder} constructs its queries the same way.
 */
@Slf4j
final class LineageSceneQuery {
  static final String DOMAINS_FQN_FIELD = "domains.fullyQualifiedName";
  static final String UPSTREAM_LINEAGE_DOC_ID_FIELD = "upstreamLineage.docId";

  private LineageSceneQuery() {}

  static Map<String, Object> term(String field, Object value) {
    return Map.of("term", Map.of(field, value));
  }

  static Map<String, Object> terms(String field, List<String> values) {
    return Map.of("terms", Map.of(field, values));
  }

  static Map<String, Object> exists(String field) {
    return Map.of("exists", Map.of("field", field));
  }

  static Map<String, Object> prefix(String field, String value) {
    return Map.of("prefix", Map.of(field, value));
  }

  static Map<String, Object> wildcard(String field, String value) {
    return Map.of("wildcard", Map.of(field, value));
  }

  static Map<String, Object> wildcardIgnoreCase(String field, String value) {
    return Map.of("wildcard", Map.of(field, Map.of("value", value, "case_insensitive", true)));
  }

  static Map<String, Object> mustNot(Map<String, Object> clause) {
    return Map.of("bool", Map.of("must_not", List.of(clause)));
  }

  /** Serializes {@code must} clauses as a {@code bool} query body. */
  static String boolMustQuery(List<Object> must) {
    return JsonUtils.pojoToJson(Map.of("query", Map.of("bool", Map.of("must", must))));
  }

  static String rootAssetQuery(
      String queryFilter, boolean includeDeleted, SubjectContext subjectContext) {
    List<Object> must = new ArrayList<>();
    must.add(term("deleted", includeDeleted));
    addQueryFilterClause(must, queryFilter);
    addDomainAccessClause(must, subjectContext);
    return boolMustQuery(must);
  }

  static String rootLineageParticipantQuery(String queryFilter, SubjectContext subjectContext) {
    List<Object> must = new ArrayList<>();
    must.add(exists(UPSTREAM_LINEAGE_DOC_ID_FIELD));
    addQueryFilterClause(must, queryFilter);
    addDomainAccessClause(must, subjectContext);
    return boolMustQuery(must);
  }

  static String parentFieldQuery(
      String fieldName, String fieldValue, boolean includeDeleted, SubjectContext subjectContext) {
    List<Object> must = new ArrayList<>();
    must.add(wildcard(fieldName, fieldValue));
    must.add(term("deleted", includeDeleted));
    addDomainAccessClause(must, subjectContext);
    return boolMustQuery(must);
  }

  static String fieldQuery(
      String fieldName,
      String fieldValue,
      String requiredExistsField,
      SubjectContext subjectContext) {
    List<Object> must = new ArrayList<>();
    must.add(wildcardIgnoreCase(fieldName, fieldValue));
    if (!nullOrEmpty(requiredExistsField)) {
      must.add(exists(requiredExistsField));
    }
    addDomainAccessClause(must, subjectContext);
    return boolMustQuery(must);
  }

  static String termsQuery(
      String fieldName, List<String> fieldValues, SubjectContext subjectContext) {
    List<Object> must = new ArrayList<>();
    must.add(terms(fieldName, fieldValues));
    addDomainAccessClause(must, subjectContext);
    return boolMustQuery(must);
  }

  private static void addQueryFilterClause(List<Object> must, String queryFilter) {
    if (!nullOrEmpty(queryFilter)) {
      try {
        JsonNode query = JsonUtils.readTree(queryFilter);
        JsonNode innerQuery = query.has("query") ? query.path("query") : query;
        if (!innerQuery.isMissingNode() && !innerQuery.isNull() && !innerQuery.isEmpty()) {
          must.add(JsonUtils.convertValue(innerQuery, new TypeReference<Map<String, Object>>() {}));
        }
      } catch (RuntimeException exception) {
        LOG.warn("Ignoring invalid lineage scene query filter", exception);
      }
    }
  }

  private static void addDomainAccessClause(List<Object> must, SubjectContext subjectContext) {
    Map<String, Object> clause = domainAccessClause(subjectContext);
    if (!clause.isEmpty()) {
      must.add(clause);
    }
  }

  /**
   * Restricts results to the caller's domains, plus assets that carry no domain at all. Returns an
   * empty map when domain filtering does not apply, so callers can skip the clause entirely.
   */
  static Map<String, Object> domainAccessClause(SubjectContext subjectContext) {
    if (!LineageDomainFilter.shouldApply(subjectContext)) {
      return Map.of();
    }
    List<Object> allowedDomains = new ArrayList<>();
    allowedDomains.add(mustNot(exists(DOMAINS_FQN_FIELD)));
    for (EntityReference domain : subjectContext.getUserDomains()) {
      if (domain == null || nullOrEmpty(domain.getFullyQualifiedName())) {
        continue;
      }
      String domainFqn = domain.getFullyQualifiedName();
      allowedDomains.add(term(DOMAINS_FQN_FIELD, domainFqn));
      allowedDomains.add(prefix(DOMAINS_FQN_FIELD, domainFqn + "."));
    }
    return Map.of("bool", Map.of("should", allowedDomains, "minimum_should_match", 1));
  }
}
