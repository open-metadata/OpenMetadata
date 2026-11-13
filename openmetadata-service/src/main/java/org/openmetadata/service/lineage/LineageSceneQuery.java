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
import static org.openmetadata.service.lineage.LineageSceneSearch.DOMAINS_FQN_FIELD;
import static org.openmetadata.service.lineage.LineageSceneSearch.UPSTREAM_LINEAGE_DOC_ID_FIELD;

import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.elasticsearch._types.FieldValue;
import es.co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.json.JsonpMappingException;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import es.co.elastic.clients.util.MissingRequiredPropertyException;
import jakarta.json.JsonException;
import jakarta.json.stream.JsonGenerator;
import jakarta.ws.rs.BadRequestException;
import java.io.StringReader;
import java.io.StringWriter;
import java.util.List;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.lineage.LineageDomainFilter;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/** Builds the shared Elasticsearch/OpenSearch query DSL at the search boundary. */
final class LineageSceneQuery {
  private static final JacksonJsonpMapper JSON_MAPPER = new JacksonJsonpMapper();

  private LineageSceneQuery() {}

  // Reasons are worded for the caller: the search client's own messages name its classes.
  static Query parseQueryFilter(String queryFilter) {
    if (nullOrEmpty(queryFilter)) {
      return null;
    }
    JsonNode filter;
    try {
      filter = JsonUtils.readTree(queryFilter);
    } catch (JsonParsingException e) {
      throw invalidQueryFilter("it is not valid JSON", e);
    }
    JsonNode innerQuery = filter.has("query") ? filter.path("query") : filter;
    if (nullOrEmpty(innerQuery)) {
      return null;
    }
    if (!innerQuery.isObject()) {
      throw invalidQueryFilter("a query must be a JSON object", null);
    }
    try {
      return Query.of(clause -> clause.withJson(new StringReader(innerQuery.toString())));
    } catch (JsonpMappingException e) {
      throw invalidQueryFilter(mappingFailure(e), e);
    } catch (MissingRequiredPropertyException e) {
      throw invalidQueryFilter(missingProperty(e), e);
    } catch (JsonException e) {
      throw invalidQueryFilter("it is not a search query", e);
    }
  }

  static BadRequestException invalidQueryFilter(String reason, Throwable cause) {
    return new BadRequestException("Invalid query_filter: " + reason, cause);
  }

  private static String mappingFailure(JsonpMappingException e) {
    String reason =
        e.getCause() instanceof MissingRequiredPropertyException missing
            ? missingProperty(missing)
            : "unexpected value";
    return nullOrEmpty(e.path()) ? reason : reason + " at '" + e.path() + "'";
  }

  private static String missingProperty(MissingRequiredPropertyException e) {
    return "missing required property '" + e.getPropertyName() + "'";
  }

  static String rootAssetQuery(LineageSceneRequest request) {
    BoolQuery.Builder query =
        new BoolQuery.Builder()
            .must(
                clause ->
                    clause.term(term -> term.field("deleted").value(request.includeDeleted())));
    return scopedQuery(query, request);
  }

  static String rootLineageParticipantQuery(LineageSceneRequest request) {
    BoolQuery.Builder query =
        new BoolQuery.Builder()
            .must(clause -> clause.exists(exists -> exists.field(UPSTREAM_LINEAGE_DOC_ID_FIELD)));
    return scopedQuery(query, request);
  }

  static String parentFieldQuery(String fieldName, String fieldValue, LineageSceneRequest request) {
    BoolQuery.Builder query =
        new BoolQuery.Builder()
            .must(
                clause -> clause.wildcard(wildcard -> wildcard.field(fieldName).value(fieldValue)))
            .must(
                clause ->
                    clause.term(term -> term.field("deleted").value(request.includeDeleted())));
    return scopedQuery(query, request);
  }

  static String assetFieldQuery(
      String fieldName,
      String fieldValue,
      String requiredExistsField,
      List<String> entityTypes,
      LineageSceneRequest request) {
    BoolQuery.Builder query = new BoolQuery.Builder().must(fieldClause(fieldName, fieldValue));
    if (!nullOrEmpty(requiredExistsField)) {
      query.must(clause -> clause.exists(exists -> exists.field(requiredExistsField)));
    }
    if (!nullOrEmpty(entityTypes)) {
      query.filter(termsClause("entityType", entityTypes));
    }
    return scopedQuery(query, request);
  }

  static String assetTermsQuery(
      String fieldName, List<String> fieldValues, LineageSceneRequest request) {
    return scopedQuery(new BoolQuery.Builder().must(termsClause(fieldName, fieldValues)), request);
  }

  private static Query termsClause(String fieldName, List<String> fieldValues) {
    List<FieldValue> values = fieldValues.stream().map(FieldValue::of).toList();
    return Query.of(
        clause ->
            clause.terms(terms -> terms.field(fieldName).terms(value -> value.value(values))));
  }

  private static String scopedQuery(BoolQuery.Builder query, LineageSceneRequest request) {
    if (request.queryFilter() != null) {
      query.must(request.queryFilter());
    }
    return scopedQuery(query, request.subjectContext());
  }

  static Query domainAccessClause(SubjectContext subjectContext) {
    if (!LineageDomainFilter.shouldApply(subjectContext)) {
      return null;
    }
    BoolQuery.Builder allowed =
        new BoolQuery.Builder()
            .minimumShouldMatch("1")
            .should(
                clause ->
                    clause.bool(
                        domainless ->
                            domainless.mustNot(
                                missing ->
                                    missing.exists(exists -> exists.field(DOMAINS_FQN_FIELD)))));
    for (EntityReference domain : subjectContext.getUserDomains()) {
      if (domain != null && !nullOrEmpty(domain.getFullyQualifiedName())) {
        String domainFqn = domain.getFullyQualifiedName();
        allowed.should(
            clause -> clause.term(term -> term.field(DOMAINS_FQN_FIELD).value(domainFqn)));
        allowed.should(
            clause ->
                clause.prefix(prefix -> prefix.field(DOMAINS_FQN_FIELD).value(domainFqn + ".")));
      }
    }
    return allowed.build()._toQuery();
  }

  static String containerQuery(String fieldName, String fieldValue, LineageSceneRequest request) {
    return scopedQuery(
        new BoolQuery.Builder().must(fieldClause(fieldName, fieldValue)), request.subjectContext());
  }

  private static Query fieldClause(String fieldName, String fieldValue) {
    return Query.of(
        clause ->
            clause.wildcard(
                wildcard -> wildcard.field(fieldName).value(fieldValue).caseInsensitive(true)));
  }

  private static String scopedQuery(BoolQuery.Builder query, SubjectContext subjectContext) {
    Query domainScope = domainAccessClause(subjectContext);
    if (domainScope != null) {
      query.must(domainScope);
    }
    return queryJson(query.build()._toQuery());
  }

  static String queryJson(Query query) {
    StringWriter writer = new StringWriter();
    try (JsonGenerator generator = JSON_MAPPER.jsonProvider().createGenerator(writer)) {
      generator.writeStartObject().writeKey("query");
      query.serialize(generator, JSON_MAPPER);
      generator.writeEnd();
    }
    return writer.toString();
  }
}
