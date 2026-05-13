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

package org.openmetadata.service.apps.bundles.rdf;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipObject;
import org.openmetadata.service.rdf.RdfRepository;

@Slf4j
public class RdfBatchProcessor {
  public static final List<Integer> ALL_RELATIONSHIPS =
      java.util.Arrays.stream(Relationship.values()).map(Relationship::ordinal).toList();

  public static final Set<String> EXCLUDED_RELATIONSHIP_ENTITY_TYPES =
      Set.of(
          "changeEvent",
          Entity.AUDIT_LOG,
          Entity.WEB_ANALYTIC_EVENT,
          "entityUsage",
          "eventSubscription",
          Entity.EVENT_SUBSCRIPTION,
          "vote",
          Entity.THREAD);

  public static final Set<Integer> EXCLUDED_RELATIONSHIP_TYPES =
      Set.of(Relationship.VOTED.ordinal(), Relationship.FOLLOWS.ordinal());

  private final CollectionDAO collectionDAO;
  private final RdfRepository rdfRepository;

  public RdfBatchProcessor(CollectionDAO collectionDAO, RdfRepository rdfRepository) {
    this.collectionDAO = collectionDAO;
    this.rdfRepository = rdfRepository;
  }

  public BatchProcessingResult processEntities(
      String entityType, List<? extends EntityInterface> entities, BooleanSupplier stopRequested) {
    if (entities == null || entities.isEmpty()) {
      return new BatchProcessingResult(0, 0);
    }

    BooleanSupplier effectiveStopRequested = stopRequested != null ? stopRequested : () -> false;
    int successCount = 0;
    int failedCount = 0;
    String lastError = null;
    List<EntityInterface> indexedEntities = new ArrayList<>();

    for (EntityInterface entity : entities) {
      if (effectiveStopRequested.getAsBoolean()) {
        break;
      }
      try {
        rdfRepository.createOrUpdate(entity);
        indexedEntities.add(entity);
        successCount++;
      } catch (Exception e) {
        LOG.error("Failed to index entity {} to RDF", entity.getId(), e);
        failedCount++;
        lastError = describeEntityError(entityType, entity.getId(), e);
      }
    }

    int relationshipFailures = 0;
    String relationshipError = null;
    if (!indexedEntities.isEmpty()) {
      RelationshipProcessingResult relResult =
          processBatchRelationships(entityType, indexedEntities);
      relationshipFailures += relResult.failureCount();
      if (relResult.lastError() != null) {
        relationshipError = relResult.lastError();
      }
      if ("glossaryTerm".equals(entityType)) {
        RelationshipProcessingResult glossResult =
            processGlossaryTermRelations(indexedEntities, effectiveStopRequested);
        relationshipFailures += glossResult.failureCount();
        if (glossResult.lastError() != null) {
          relationshipError = glossResult.lastError();
        }
      }
    }

    // Relationship failures are tracked separately from entity write failures.
    // failedCount becomes "failedRecords" in the index stats, where a record is
    // an entity row — folding relationship failures (which are per-edge, not
    // per-entity) into it would inflate failedRecords beyond the totalRecords
    // entity count and make stats nonsensical. Surface relationship errors only
    // through lastError when no entity-level failure already provided one.
    if (lastError == null && relationshipError != null) {
      lastError = relationshipError;
    }

    return new BatchProcessingResult(successCount, failedCount, relationshipFailures, lastError);
  }

  public record RelationshipProcessingResult(int failureCount, String lastError) {
    static final RelationshipProcessingResult OK = new RelationshipProcessingResult(0, null);
  }

  /**
   * Format a single failure with a context-specific prefix using the root cause's
   * message (or class name when the message is blank). Used by the per-entity,
   * bulk-relationship, and lineage-relationship error paths to keep their output
   * format consistent.
   */
  private static String describeError(String prefix, Throwable error) {
    Throwable rootCause = error;
    while (rootCause.getCause() != null && rootCause.getCause() != rootCause) {
      rootCause = rootCause.getCause();
    }
    String message = rootCause.getMessage();
    if (message == null || message.isBlank()) {
      message = rootCause.getClass().getSimpleName();
    }
    return prefix + ": " + message;
  }

  private static String describeEntityError(String entityType, UUID entityId, Throwable error) {
    return describeError(entityType + "/" + entityId, error);
  }

  public RelationshipProcessingResult processBatchRelationships(
      String entityType, List<? extends EntityInterface> entities) {
    if (entities == null || entities.isEmpty()) {
      return RelationshipProcessingResult.OK;
    }

    int failures = 0;
    String lastError = null;

    try {
      List<String> entityIds =
          entities.stream().map(entity -> entity.getId().toString()).collect(Collectors.toList());

      List<EntityRelationshipObject> outgoingRelationships =
          collectionDAO
              .relationshipDAO()
              .findToBatchWithRelations(entityIds, entityType, ALL_RELATIONSHIPS);

      List<EntityRelationshipObject> incomingLineage =
          collectionDAO
              .relationshipDAO()
              .findFromBatch(
                  entityIds,
                  Relationship.UPSTREAM.ordinal(),
                  org.openmetadata.schema.type.Include.ALL);

      List<org.openmetadata.schema.type.EntityRelationship> allRelationships = new ArrayList<>();

      for (EntityRelationshipObject rel : outgoingRelationships) {
        if (shouldSkipRelationship(rel)) {
          continue;
        }

        if (rel.getRelation() == Relationship.UPSTREAM.ordinal() && rel.getJson() != null) {
          String error = processLineageRelationship(rel);
          if (error != null) {
            failures++;
            lastError = error;
          }
        } else {
          if ("glossaryTerm".equals(entityType)
              && rel.getRelation() == Relationship.RELATED_TO.ordinal()
              && "glossaryTerm".equals(rel.getToEntity())) {
            continue;
          }
          allRelationships.add(convertToEntityRelationship(rel));
        }
      }

      for (EntityRelationshipObject rel : incomingLineage) {
        if (shouldSkipRelationship(rel)) {
          continue;
        }

        if (rel.getJson() != null) {
          String error = processLineageRelationship(rel);
          if (error != null) {
            failures++;
            lastError = error;
          }
        } else {
          allRelationships.add(convertToEntityRelationship(rel));
        }
      }

      if (!allRelationships.isEmpty()) {
        try {
          rdfRepository.bulkAddRelationships(allRelationships);
        } catch (Exception e) {
          LOG.error(
              "Failed to bulk add {} relationships for entity type {}",
              allRelationships.size(),
              entityType,
              e);
          failures += allRelationships.size();
          lastError = describeBulkError(entityType, "bulkRelationships", e);
        }
      }
    } catch (Exception e) {
      LOG.error("Failed to process batch relationships for entity type {}", entityType, e);
      failures++;
      lastError = describeBulkError(entityType, "batchRelationships", e);
    }

    return new RelationshipProcessingResult(failures, lastError);
  }

  private static String describeBulkError(String entityType, String stage, Throwable error) {
    return describeError(entityType + "/" + stage, error);
  }

  public org.openmetadata.schema.type.EntityRelationship convertToEntityRelationship(
      EntityRelationshipObject rel) {
    return new org.openmetadata.schema.type.EntityRelationship()
        .withFromEntity(rel.getFromEntity())
        .withFromId(UUID.fromString(rel.getFromId()))
        .withToEntity(rel.getToEntity())
        .withToId(UUID.fromString(rel.getToId()))
        .withRelation(rel.getRelation())
        .withRelationshipType(Relationship.values()[rel.getRelation()]);
  }

  private boolean shouldSkipRelationship(EntityRelationshipObject rel) {
    return EXCLUDED_RELATIONSHIP_ENTITY_TYPES.contains(rel.getToEntity())
        || EXCLUDED_RELATIONSHIP_ENTITY_TYPES.contains(rel.getFromEntity())
        || EXCLUDED_RELATIONSHIP_TYPES.contains(rel.getRelation());
  }

  String processLineageRelationship(EntityRelationshipObject rel) {
    UUID fromId;
    UUID toId;
    LineageDetails lineageDetails;
    try {
      fromId = UUID.fromString(rel.getFromId());
      toId = UUID.fromString(rel.getToId());
      lineageDetails = JsonUtils.readValue(rel.getJson(), LineageDetails.class);
    } catch (Exception parseError) {
      LOG.debug("Failed to parse lineage details, falling back to basic relationship", parseError);
      try {
        rdfRepository.addRelationship(convertToEntityRelationship(rel));
        return null;
      } catch (Exception ex) {
        LOG.error(
            "Failed to add basic lineage relationship for {}->{}",
            rel.getFromId(),
            rel.getToId(),
            ex);
        return describeLineageError(rel, ex);
      }
    }

    try {
      rdfRepository.addLineageWithDetails(
          rel.getFromEntity(), fromId, rel.getToEntity(), toId, lineageDetails);
      return null;
    } catch (Exception e) {
      LOG.error("Failed to add lineage with details for {}->{}", rel.getFromId(), rel.getToId(), e);
      return describeLineageError(rel, e);
    }
  }

  private static String describeLineageError(EntityRelationshipObject rel, Throwable error) {
    return describeError("lineage " + rel.getFromId() + "->" + rel.getToId(), error);
  }

  RelationshipProcessingResult processGlossaryTermRelations(
      List<? extends EntityInterface> entities, BooleanSupplier stopRequested) {
    List<RdfRepository.GlossaryTermRelationData> relations = new ArrayList<>();

    for (EntityInterface entity : entities) {
      if (stopRequested.getAsBoolean()) {
        break;
      }

      if (!(entity instanceof GlossaryTerm glossaryTerm)) {
        continue;
      }

      List<TermRelation> relatedTerms = glossaryTerm.getRelatedTerms();
      if (relatedTerms == null || relatedTerms.isEmpty()) {
        continue;
      }

      UUID fromTermId = glossaryTerm.getId();
      for (TermRelation termRelation : relatedTerms) {
        if (termRelation.getTerm() == null || termRelation.getTerm().getId() == null) {
          continue;
        }

        String relationType =
            termRelation.getRelationType() != null ? termRelation.getRelationType() : "relatedTo";
        relations.add(
            new RdfRepository.GlossaryTermRelationData(
                fromTermId, termRelation.getTerm().getId(), relationType));
      }
    }

    if (relations.isEmpty()) {
      return RelationshipProcessingResult.OK;
    }

    try {
      rdfRepository.bulkAddGlossaryTermRelations(relations);
      return RelationshipProcessingResult.OK;
    } catch (Exception e) {
      LOG.error("Failed to bulk add {} glossary term relations", relations.size(), e);
      return new RelationshipProcessingResult(
          relations.size(), describeBulkError("glossaryTerm", "glossaryRelations", e));
    }
  }

  /**
   * Outcome of processing a batch of entities.
   *
   * @param successCount entity-level write successes
   * @param failedCount entity-level write failures (counts toward failedRecords stats)
   * @param relationshipFailureCount per-edge relationship/lineage failures, kept
   *     separate so they don't inflate the entity-level failedRecords stat
   * @param lastError most recent failure message (entity or relationship)
   */
  public record BatchProcessingResult(
      int successCount, int failedCount, int relationshipFailureCount, String lastError) {
    public BatchProcessingResult(int successCount, int failedCount) {
      this(successCount, failedCount, 0, null);
    }

    public BatchProcessingResult(int successCount, int failedCount, String lastError) {
      this(successCount, failedCount, 0, lastError);
    }

    public boolean hasAnyFailure() {
      return failedCount > 0 || relationshipFailureCount > 0;
    }
  }
}
