package org.openmetadata.service.security.mask;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseResult;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class TestCaseSearchMasker {
  private static final Logger LOG = LoggerFactory.getLogger(TestCaseSearchMasker.class);
  private static final List<String> SENSITIVE_FIELDS =
      List.of(
          "description",
          "parameterValues",
          "testCaseResult",
          "textToEmbed",
          "textToLLMContext",
          "changeDescription",
          "incrementalChangeDescription");
  private final PIIMasker.TestCaseMasker masker;
  private final String testCaseIndex;
  private final String resultIndex;
  private final String sortField;
  private static final Set<String> RESULT_SORT_FIELDS =
      Set.of(
          "id",
          "testCaseFQN",
          "timestamp",
          "@timestamp",
          "entityType",
          "_score",
          "_id",
          "_doc",
          "_shard_doc");

  private TestCaseSearchMasker(
      Authorizer authorizer,
      SecurityContext securityContext,
      String testCaseIndex,
      String resultIndex,
      String sortField) {
    this.masker = new PIIMasker.TestCaseMasker(authorizer, securityContext);
    this.testCaseIndex = testCaseIndex;
    this.resultIndex = resultIndex;
    this.sortField = sortField;
  }

  public static Response mask(
      Response response,
      Authorizer authorizer,
      SecurityContext securityContext,
      String testCaseIndex,
      String resultIndex) {
    return new TestCaseSearchMasker(authorizer, securityContext, testCaseIndex, resultIndex, null)
        .maskResponse(response);
  }

  public static Response mask(
      Response response,
      Authorizer authorizer,
      SecurityContext securityContext,
      SearchRepository searchRepository,
      String sortField) {
    return new TestCaseSearchMasker(
            authorizer,
            securityContext,
            searchRepository.getIndexOrAliasName(Entity.TEST_CASE),
            searchRepository.getIndexOrAliasName(Entity.TEST_CASE_RESULT),
            sortField)
        .maskResponse(response);
  }

  private Response maskResponse(Response response) {
    final Object body = response.getEntity();
    if (response.getStatus() != Response.Status.OK.getStatusCode() || body == null) {
      return response;
    }
    final JsonNode root =
        body instanceof String json ? JsonUtils.readTree(json) : JsonUtils.valueToTree(body);
    return maskHits(root.path("hits").path("hits"))
        ? Response.fromResponse(response)
            .entity(body instanceof String ? root.toString() : root)
            .build()
        : response;
  }

  private boolean maskHits(JsonNode hits) {
    boolean masked = false;
    for (JsonNode node : hits) {
      if (node instanceof ObjectNode hit) {
        masked |= maskHit(hit);
        for (JsonNode innerHits : hit.path("inner_hits")) {
          masked |= maskHits(innerHits.path("hits").path("hits"));
        }
      }
    }
    return masked;
  }

  private boolean maskHit(ObjectNode hit) {
    final boolean isResult = matchesIndex(hit, resultIndex);
    final boolean isTestCase = matchesIndex(hit, testCaseIndex);
    if ((!isTestCase && !isResult) || !masker.shouldMask(resolveTestCase(hit, isResult))) {
      return false;
    }
    validateSort(isResult);
    if (hit.path("_source") instanceof ObjectNode source) {
      maskSource(source, isResult);
    }
    // Search metadata can carry indexed values even with _source disabled.
    hit.remove(List.of("highlight", "fields", "_explanation"));
    return true;
  }

  private void validateSort(boolean isResult) {
    if (sortField != null) {
      // Sort values are returned in cursors, so filtering _source alone cannot hide them.
      final String rootField = sortField.split("\\.", 2)[0];
      final boolean unavailable =
          isResult ? !RESULT_SORT_FIELDS.contains(rootField) : SENSITIVE_FIELDS.contains(rootField);
      if (unavailable) {
        throw new BadRequestException(
            "Sorting by the requested field is unavailable for these results.");
      }
    }
  }

  private void maskSource(ObjectNode source, boolean isResult) {
    if (isResult) {
      source.retain("id", "testCaseFQN", "timestamp", "entityType");
    } else {
      source.remove(SENSITIVE_FIELDS);
      if (source.path("name").isTextual()) {
        source.put("name", PIIMasker.flagMaskedName(source.path("name").asText()));
      }
    }
  }

  private boolean matchesIndex(JsonNode hit, String indexName) {
    final String index = hit.path("_index").asText();
    return index.equals(indexName) || index.startsWith(indexName + "_");
  }

  private TestCase resolveTestCase(JsonNode hit, boolean isResult) {
    final JsonNode source = hit.path("_source");
    if (!isResult && source.path("entityLink").isTextual()) {
      return new TestCase().withEntityLink(source.path("entityLink").asText());
    }
    if (isResult && source.path("testCaseFQN").isTextual()) {
      return masker.findTestCase(source.path("testCaseFQN").asText());
    }
    // Projections may omit the link or FQN; the hit's identity still resolves its masking policy.
    return resolveById(hit, isResult);
  }

  private TestCase resolveById(JsonNode hit, boolean isResult) {
    if (!hit.path("_id").isTextual()) {
      return null;
    }
    final UUID id = UUID.fromString(hit.path("_id").asText());
    try {
      return isResult ? resolveResult(id) : Entity.getEntity(Entity.TEST_CASE, id, "", Include.ALL);
    } catch (EntityNotFoundException e) {
      LOG.debug("Search hit references test case [{}] that no longer exists", id);
      return null;
    }
  }

  private TestCase resolveResult(UUID id) {
    final TestCaseResult result =
        (TestCaseResult) Entity.getEntityTimeSeriesRepository(Entity.TEST_CASE_RESULT).getById(id);
    return result == null ? null : masker.findTestCase(result.getTestCaseFQN());
  }
}
