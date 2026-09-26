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

package org.openmetadata.service.ontology;

import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyDiscoveryEvidence;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.RelationshipTypeRepository;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;

public final class OpenMetadataOntologyAiCatalog implements OntologyAiCatalog {
  private final GlossaryRepository glossaryRepository;
  private final GlossaryTermRepository termRepository;
  private final RelationshipTypeRepository relationshipTypeRepository;

  public OpenMetadataOntologyAiCatalog(
      final GlossaryRepository glossaryRepository,
      final GlossaryTermRepository termRepository,
      final RelationshipTypeRepository relationshipTypeRepository) {
    this.glossaryRepository = glossaryRepository;
    this.termRepository = termRepository;
    this.relationshipTypeRepository = relationshipTypeRepository;
  }

  @Override
  public Glossary glossary(final String fullyQualifiedName) {
    return glossaryRepository.getByName(
        null, fullyQualifiedName, glossaryRepository.getFields("ontologyConfiguration"));
  }

  @Override
  public GlossaryTerm term(final UUID id) {
    return termRepository.get(
        null,
        id,
        termRepository.getFields("glossary,attributes,realizedIn"),
        Include.NON_DELETED,
        false);
  }

  @Override
  public Table table(final String fullyQualifiedName) {
    return Entity.getEntityByName(
        Entity.TABLE, fullyQualifiedName, "service,columns", Include.NON_DELETED);
  }

  @Override
  public RelationshipType relationshipType(final UUID id) {
    return relationshipTypeRepository.get(
        null, id, relationshipTypeRepository.getFields("domain,range"), Include.NON_DELETED, false);
  }

  @Override
  public void validateDiscoveryEvidence(
      final OntologyDiscoveryEvidence evidence, final String expectedServiceFullyQualifiedName) {
    final EntityInterface entity =
        Entity.getEntityByName(
            evidence.getEntityType(),
            evidence.getFullyQualifiedName(),
            Entity.TEST_CASE.equals(evidence.getEntityType()) ? "entityLink" : "service",
            Include.NON_DELETED);
    if (evidence.getSourceVersion() != null
        && !Objects.equals(evidence.getSourceVersion(), entity.getVersion())) {
      throw staleEvidence(evidence, "version", evidence.getSourceVersion(), entity.getVersion());
    }
    if (evidence.getUpdatedAt() != null
        && !Objects.equals(evidence.getUpdatedAt(), entity.getUpdatedAt())) {
      throw staleEvidence(evidence, "updatedAt", evidence.getUpdatedAt(), entity.getUpdatedAt());
    }
    final EntityInterface owner = serviceOwner(entity);
    if (owner.getService() == null) {
      throw new IllegalArgumentException(
          "Ontology discovery evidence '"
              + evidence.getFullyQualifiedName()
              + "' is not scoped to a catalog service");
    }
    if (!Objects.equals(
        expectedServiceFullyQualifiedName, owner.getService().getFullyQualifiedName())) {
      throw new IllegalArgumentException(
          "Ontology discovery evidence '"
              + evidence.getFullyQualifiedName()
              + "' belongs to service '"
              + owner.getService().getFullyQualifiedName()
              + "', not '"
              + expectedServiceFullyQualifiedName
              + "'");
    }
  }

  private static EntityInterface serviceOwner(final EntityInterface entity) {
    if (!(entity instanceof TestCase testCase)) {
      return entity;
    }
    final EntityLink link = EntityLink.parse(testCase.getEntityLink());
    if (!Entity.TABLE.equals(link.getEntityType())) {
      throw new IllegalArgumentException("Ontology quality evidence must belong to a table");
    }
    return Entity.getEntityByName(
        Entity.TABLE, link.getEntityFQN(), "service", Include.NON_DELETED);
  }

  private static IllegalArgumentException staleEvidence(
      final OntologyDiscoveryEvidence evidence,
      final String field,
      final Object observed,
      final Object current) {
    return new IllegalArgumentException(
        "Stale ontology discovery evidence '"
            + evidence.getEntityType()
            + ":"
            + evidence.getFullyQualifiedName()
            + "': observed "
            + field
            + " "
            + observed
            + ", current "
            + current);
  }
}
