package org.openmetadata.service.search.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import es.co.elastic.clients.elasticsearch._types.query_dsl.Query;
import es.co.elastic.clients.json.jackson.JacksonJsonpMapper;
import java.io.StringWriter;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.elasticsearch.ElasticSearchRequestBuilder;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilder;
import org.openmetadata.service.search.elasticsearch.queries.ElasticQueryBuilderFactory;
import org.openmetadata.service.search.opensearch.OpenSearchRequestBuilder;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilder;
import org.openmetadata.service.search.opensearch.queries.OpenSearchQueryBuilderFactory;
import org.openmetadata.service.search.queries.OMQueryBuilder;
import org.openmetadata.service.search.queries.QueryBuilderFactory;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

class AuditReportSearchVisibilityTest {
  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void requesterBranchRequiresBothTheReportTypeAndTheirImmutableId(final boolean openSearch) {
    final UUID userId = UUID.randomUUID();
    final SubjectContext subject =
        new SubjectContext(new User().withId(userId).withName("reader"), null);
    final JsonNode query =
        json(new AuditReportSearchVisibility(factory(openSearch)).buildVisibilityFilter(subject));
    final JsonNode alternatives = query.path("bool").path("should");
    assertEquals(2, alternatives.size());
    assertFalse(query.path("bool").has("must"));
    assertFalse(query.path("bool").has("filter"));
    assertEquals(
        Entity.AUDIT_REPORT,
        alternatives
            .get(0)
            .path("bool")
            .path("must_not")
            .get(0)
            .path("term")
            .path("entityType")
            .path("value")
            .asText());
    final JsonNode required = alternatives.get(1).path("bool").path("must");
    assertEquals(
        Entity.AUDIT_REPORT,
        required.get(0).path("term").path("entityType").path("value").asText());
    assertEquals(
        userId.toString(),
        required.get(1).path("term").path("requestedBy.id.keyword").path("value").asText());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void administratorsMaySearchAllReports(final boolean openSearch) {
    final SubjectContext admin = new SubjectContext(new User().withIsAdmin(true), null);
    assertTrue(
        new AuditReportSearchVisibility(factory(openSearch))
            .buildVisibilityFilter(admin)
            .isMatchAll());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void unresolvedSubjectsNeverGainARequesterBranch(final boolean openSearch) {
    final AuditReportSearchVisibility visibility =
        new AuditReportSearchVisibility(factory(openSearch));
    final JsonNode anonymous = json(visibility.buildVisibilityFilter(null));
    final JsonNode missingId =
        json(
            visibility.buildVisibilityFilter(
                new SubjectContext(new User().withName("missing"), null)));
    assertEquals(anonymous, missingId);
    assertFalse(anonymous.path("bool").has("should"));
    assertEquals(
        Entity.AUDIT_REPORT,
        anonymous
            .path("bool")
            .path("must_not")
            .get(0)
            .path("term")
            .path("entityType")
            .path("value")
            .asText());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void resolvingMemoryVisibilityDoesNotBypassTheReportFallback(final boolean openSearch) {
    final String query;
    if (openSearch) {
      query =
          new OpenSearchRequestBuilder()
              .contextMemoryVisibilityResolved()
              .build("all")
              .query()
              .toJsonString();
    } else {
      query =
          elasticJson(
              new ElasticSearchRequestBuilder()
                  .contextMemoryVisibilityResolved()
                  .build("all")
                  .query());
    }
    assertTrue(query.contains("must_not"));
    assertTrue(query.contains(Entity.AUDIT_REPORT));
    assertFalse(query.contains("requestedBy"));
  }

  private static QueryBuilderFactory factory(final boolean openSearch) {
    return openSearch ? new OpenSearchQueryBuilderFactory() : new ElasticQueryBuilderFactory();
  }

  private static JsonNode json(final OMQueryBuilder query) {
    final String serialized =
        query instanceof OpenSearchQueryBuilder openSearch
            ? openSearch.buildV2().toJsonString()
            : elasticJson(((ElasticQueryBuilder) query).buildV2());
    return JsonUtils.readValue(serialized, JsonNode.class);
  }

  private static String elasticJson(final Query query) {
    final JacksonJsonpMapper mapper = new JacksonJsonpMapper();
    final StringWriter writer = new StringWriter();
    try (final var generator = mapper.jsonProvider().createGenerator(writer)) {
      query.serialize(generator, mapper);
    }
    return writer.toString();
  }
}
