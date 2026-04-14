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
      }
    }

    if (!indexedEntities.isEmpty()) {
      processBatchRelationships(entityType, indexedEntities);
      if ("glossaryTerm".equals(entityType)) {
        processGlossaryTermRelations(indexedEntities, effectiveStopRequested);
      }
    }

    return new BatchProcessingResult(successCount, failedCount);
  }

  public void processBatchRelationships(
      String entityType, List<? extends EntityInterface> entities) {
    if (entities == null || entities.isEmpty()) {
      return;
    }

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
          processLineageRelationship(rel);
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
          processLineageRelationship(rel);
        } else {
          allRelationships.add(convertToEntityRelationship(rel));
        }
      }

      if (!allRelationships.isEmpty()) {
        rdfRepository.bulkAddRelationships(allRelationships);
      }
    } catch (Exception e) {
      LOG.error("Failed to process batch relationships for entity type {}", entityType, e);
    }
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

  void processLineageRelationship(EntityRelationshipObject rel) {
    try {
      UUID fromId = UUID.fromString(rel.getFromId());
      UUID toId = UUID.fromString(rel.getToId());
      LineageDetails lineageDetails = JsonUtils.readValue(rel.getJson(), LineageDetails.class);
      rdfRepository.addLineageWithDetails(
          rel.getFromEntity(), fromId, rel.getToEntity(), toId, lineageDetails);
    } catch (Exception e) {
      LOG.debug("Failed to parse lineage details, falling back to basic relationship", e);
      try {
        rdfRepository.addRelationship(convertToEntityRelationship(rel));
      } catch (Exception ex) {
        LOG.debug("Failed to add basic lineage relationship", ex);
      }
    }
  }

  void processGlossaryTermRelations(
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

    if (!relations.isEmpty()) {
      rdfRepository.bulkAddGlossaryTermRelations(relations);
    }
  }

  public record BatchProcessingResult(int successCount, int failedCount) {}
}
