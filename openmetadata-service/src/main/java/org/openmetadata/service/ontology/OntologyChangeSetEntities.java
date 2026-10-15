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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationResult;
import org.openmetadata.schema.type.OntologyChangeOperationResultStatus;
import org.openmetadata.schema.type.OntologyChangeOperationState;
import org.openmetadata.service.Entity;

/**
 * The axioms and terms whose ontology graphs a change set changes: those its applied operations
 * produced, and those its active operations create or edit. Relationship and mapping operations
 * change no ontology graph, and deletions add nothing to check.
 */
public final class OntologyChangeSetEntities {
  private OntologyChangeSetEntities() {}

  public static Set<UUID> of(final OntologyChangeSet changeSet) {
    final Set<UUID> ids = new LinkedHashSet<>();
    if (changeSet.getApplicationResult() != null) {
      for (final OntologyChangeOperationResult result :
          listOrEmpty(changeSet.getApplicationResult().getResults())) {
        final EntityReference entity = result.getEntity();
        if (result.getStatus() == OntologyChangeOperationResultStatus.APPLIED
            && entity != null
            && entity.getId() != null
            && (Entity.ONTOLOGY_AXIOM.equals(entity.getType())
                || Entity.GLOSSARY_TERM.equals(entity.getType()))) {
          ids.add(entity.getId());
        }
      }
    }
    for (final OntologyChangeOperation operation : listOrEmpty(changeSet.getOperations())) {
      if (operation.getState() == OntologyChangeOperationState.ACTIVE) {
        addTouched(ids, operation);
      }
    }
    return ids;
  }

  private static void addTouched(final Set<UUID> ids, final OntologyChangeOperation operation) {
    switch (operation.getOperationType()) {
      case UPSERT_AXIOM -> {
        addIfPresent(ids, operation.getTargetId());
        if (operation.getAxiom() != null) {
          addIfPresent(ids, operation.getAxiom().getId());
        }
      }
      case CREATE_TERM, UPDATE_TERM -> {
        addIfPresent(ids, operation.getTargetId());
        if (operation.getTerm() != null) {
          addIfPresent(ids, operation.getTerm().getId());
        }
      }
      case UPSERT_ATTRIBUTE, DELETE_ATTRIBUTE -> addIfPresent(ids, operation.getTargetId());
      default -> {}
    }
  }

  private static void addIfPresent(final Set<UUID> ids, final UUID id) {
    if (id != null) {
      ids.add(id);
    }
  }
}
