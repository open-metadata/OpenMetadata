/*
 *  Copyright 2022 Collate
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

package org.openmetadata.service.workflows.searchIndex;

import static org.openmetadata.service.apps.bundles.searchIndex.SearchIndexEntityTypes.TIME_SERIES_ENTITIES;
import static org.openmetadata.service.search.SearchClient.GLOBAL_SEARCH_ALIAS;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import es.co.elastic.clients.elasticsearch.core.bulk.BulkResponseItem;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class ReindexingUtil {
  private ReindexingUtil() {
    /*unused*/
  }

  public static final String ENTITY_TYPE_KEY = "entityType";
  public static final String TIMESTAMP_KEY = "@timestamp";
  public static final String TARGET_INDEX_KEY = "targetIndex";
  public static final String RECREATE_CONTEXT = "recreateContext";

  public static void getUpdatedStats(StepStats stats, int currentSuccess, int currentFailed) {
    stats.setSuccessRecords(stats.getSuccessRecords() + currentSuccess);
    stats.setFailedRecords(stats.getFailedRecords() + currentFailed);
  }

  public static void getUpdatedStats(
      StepStats stats, int currentSuccess, int currentFailed, int currentWarnings) {
    stats.setSuccessRecords(stats.getSuccessRecords() + currentSuccess);
    stats.setFailedRecords(stats.getFailedRecords() + currentFailed);
    stats.setWarningRecords(
        (stats.getWarningRecords() != null ? stats.getWarningRecords() : 0) + currentWarnings);
  }

  /**
   * Returns true when an EntityError represents a stale reference — either a missing entity
   * (canonical {@code EntityNotFoundException}) or a missing entity_relationship row (raised by
   * {@code EntityRepository.ensureSingleRelationship} as "does not have expected relationship
   * ..."). Both are expected during reindexing of long-lived records: e.g. a
   * {@code testCaseResolutionStatus} migrated without a corresponding {@code parentOf} row, or
   * an entity hard-deleted out-of-band leaving its relationship rows behind. Such records
   * cannot be meaningfully indexed and are reported as warnings rather than failing the entire
   * batch.
   *
   * <p>The patterns are deliberately specific so we do not misclassify unrelated errors that
   * happen to contain {@code "not found"} (e.g. {@code "Column 'foo' not found in result set"}
   * or {@code "SSL certificate not found"}). They cover every {@code EntityNotFoundException}
   * factory message ({@code byId}, {@code byName}, {@code byFilter}, {@code byVersion},
   * {@code byParserSchema}) plus the legacy {@code CatalogExceptionMessage.entityNotFound}
   * format and the relationship-not-found shape.
   */
  public static boolean isStaleReferenceError(EntityError error) {
    if (error == null || error.getMessage() == null) {
      return false;
    }
    String message = error.getMessage().toLowerCase(java.util.Locale.ROOT);
    return message.contains("instance for")
        || message.contains("entity not found")
        || message.contains("entity with id")
        || message.contains("entity with name")
        || message.contains("parser schema not found")
        || message.contains("does not exist")
        || message.contains("entitynotfoundexception")
        || message.contains("expected relationship");
  }

  /**
   * Splits {@code errors} into stale-relationship warnings (appended to {@code warningsOut}) and
   * real failures (returned). Both lists must be mutable; {@code warningsOut} must be non-null.
   */
  public static List<EntityError> partitionErrors(
      List<EntityError> errors, List<EntityError> warningsOut) {
    Objects.requireNonNull(warningsOut, "warningsOut must not be null");
    if (CommonUtil.nullOrEmpty(errors)) {
      return new ArrayList<>();
    }
    List<EntityError> realErrors = new ArrayList<>(errors.size());
    for (EntityError error : errors) {
      if (isStaleReferenceError(error)) {
        warningsOut.add(error);
      } else {
        realErrors.add(error);
      }
    }
    return realErrors;
  }

  public static boolean isDataInsightIndex(String entityType) {
    return Entity.getSearchRepository().getDataInsightReports().contains(entityType);
  }

  public static Stats getInitialStatsForEntities(Set<String> entities) {
    Stats initialStats = new Stats();
    EntityStats entityLevelStat = new EntityStats();
    int total = 0;

    for (String entityType : entities) {
      try {
        if (!TIME_SERIES_ENTITIES.contains(entityType)) {
          EntityRepository<?> repository = Entity.getEntityRepository(entityType);
          int entityCount = repository.getDao().listTotalCount();
          total += entityCount;
          entityLevelStat.withAdditionalProperty(
              entityType, new StepStats().withTotalRecords(entityCount));
        } else {
          EntityTimeSeriesRepository<?> repository;
          ListFilter listFilter = new ListFilter(null);
          if (isDataInsightIndex(entityType)) {
            listFilter.addQueryParam("entityFQNHash", FullyQualifiedName.buildHash(entityType));
            repository = Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA);
          } else {
            repository = Entity.getEntityTimeSeriesRepository(entityType);
          }
          int entityCount = repository.getTimeSeriesDao().listCount(listFilter);
          total += entityCount;
          entityLevelStat.withAdditionalProperty(
              entityType, new StepStats().withTotalRecords(entityCount));
        }
      } catch (Exception e) {
        LOG.debug("Error while getting total entities to index", e);
      }
    }
    initialStats.setJobStats(new StepStats().withTotalRecords(total));
    initialStats.setEntityStats(entityLevelStat);
    return initialStats;
  }

  public static List<EntityError> getErrorsFromBulkResponse(
      es.co.elastic.clients.elasticsearch.core.BulkResponse response) {
    List<EntityError> entityErrors = new ArrayList<>();
    for (BulkResponseItem bulkItemResponse : response.items()) {
      if (bulkItemResponse.error() != null) {
        entityErrors.add(
            new EntityError()
                .withMessage(bulkItemResponse.error().reason())
                .withEntity(bulkItemResponse.id()));
      }
    }
    return entityErrors;
  }

  public static List<EntityError> getErrorsFromBulkResponse(
      os.org.opensearch.client.opensearch.core.BulkResponse response) {
    List<EntityError> entityErrors = new ArrayList<>();
    for (os.org.opensearch.client.opensearch.core.bulk.BulkResponseItem bulkItemResponse :
        response.items()) {
      if (bulkItemResponse.error() != null) {
        entityErrors.add(
            new EntityError()
                .withMessage(bulkItemResponse.error().reason())
                .withEntity(bulkItemResponse.id()));
      }
    }
    return entityErrors;
  }

  @SneakyThrows
  public static List<EntityReference> findReferenceInElasticSearchAcrossAllIndexes(
      String matchingKey, String sourceFqn, int from) {
    String key = "_source";
    SearchRequest searchRequest =
        new SearchRequest()
            .withQuery(String.format("(%s:\"%s\")", matchingKey, sourceFqn))
            .withSize(100)
            .withIndex(Entity.getSearchRepository().getIndexOrAliasName(GLOBAL_SEARCH_ALIAS))
            .withFrom(from)
            .withFetchSource(true)
            .withTrackTotalHits(false)
            .withSortFieldParam("_score")
            .withDeleted(false)
            .withSortOrder("desc")
            .withIncludeSourceFields(new ArrayList<>());
    List<EntityReference> entities = new ArrayList<>();
    Response response = Entity.getSearchRepository().search(searchRequest, null);
    String json = (String) response.getEntity();

    for (Iterator<JsonNode> it =
            ((ArrayNode) JsonUtils.extractValue(json, "hits", "hits")).elements();
        it.hasNext(); ) {
      JsonNode jsonNode = it.next();
      String id = JsonUtils.extractValue(jsonNode, key, "id");
      String fqn = JsonUtils.extractValue(jsonNode, key, "fullyQualifiedName");
      String type = JsonUtils.extractValue(jsonNode, key, "entityType");
      if (!CommonUtil.nullOrEmpty(fqn) && !CommonUtil.nullOrEmpty(type)) {
        entities.add(
            new EntityReference()
                .withId(UUID.fromString(id))
                .withFullyQualifiedName(fqn)
                .withType(type));
      }
    }

    return entities;
  }

  public static List<String> getSearchIndexFields(String entityType) {
    if (TIME_SERIES_ENTITIES.contains(entityType)) {
      return List.of();
    }
    org.openmetadata.service.search.SearchRepository repo =
        org.openmetadata.service.Entity.getSearchRepository();
    if (repo == null || repo.getSearchIndexFactory() == null) {
      // Search subsystem isn't bootstrapped (e.g. unit tests that exercise the reader without the
      // full Entity registry). Behaves the same as the pre-selective-fields code path.
      return List.of("*");
    }
    List<String> allFields;
    try {
      allFields = new ArrayList<>(repo.getSearchIndexFactory().getReindexFieldsFor(entityType));
    } catch (Exception e) {
      LOG.error(
          "Failed to look up reindex fields for {}: {}; falling back to all-fields wildcard",
          entityType,
          e.getMessage());
      return List.of("*");
    }
    try {
      return new ArrayList<>(Entity.getOnlySupportedFields(entityType, allFields).getFieldList());
    } catch (Exception e) {
      // Filtering failed (typically because the EntityRepository isn't registered yet —
      // happens during boot or in tests). Fall back to the unfiltered required set rather than
      // "*": this keeps the per-entity intent intact and lets PaginatedEntitiesSource surface
      // any drift loudly instead of silently sending every field.
      LOG.warn(
          "Could not filter reindex fields for {} against EntityRepository.allowedFields ({}); "
              + "returning unfiltered required set",
          entityType,
          e.getMessage());
      return allFields;
    }
  }

  public static String escapeDoubleQuotes(String str) {
    return str.replace("\"", "\\\"");
  }
}
