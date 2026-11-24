/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.api.data.UpdateTermRelation;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;

public final class TermRelationMutator {
  private TermRelationMutator() {}

  public static TermRelation requireById(GlossaryTerm term, UUID relationshipId) {
    return listOrEmpty(term.getRelatedTerms()).stream()
        .filter(relation -> relationshipId.equals(relation.getId()))
        .findFirst()
        .orElseThrow(
            () ->
                new EntityNotFoundException(
                    "Relationship '%s' was not found on glossary term '%s'"
                        .formatted(relationshipId, term.getId())));
  }

  public static void requireMutable(TermRelation relation) {
    if (relation.getProvenance() == RelationProvenance.INFERRED) {
      throw new BadRequestException(
          "Inferred relationship '%s' is read-only".formatted(relation.getId()));
    }
  }

  public static void requireAuthoredProvenance(RelationProvenance provenance) {
    if (provenance == RelationProvenance.INFERRED) {
      throw new BadRequestException("Inferred relationship provenance is server-managed");
    }
  }

  public static void requireUpdate(UpdateTermRelation request) {
    boolean isEmpty =
        request.getRelationType() == null
            && request.getProvenance() == null
            && request.getStatus() == null;
    if (isEmpty) {
      throw new BadRequestException("At least one relationship field must be updated");
    }
    requireAuthoredProvenance(request.getProvenance());
  }

  public static String updatedType(TermRelation existing, UpdateTermRelation request) {
    return Objects.requireNonNullElse(request.getRelationType(), existing.getRelationType());
  }

  public static TermRelation update(
      TermRelation existing, UpdateTermRelation request, String validatedRelationType) {
    return new TermRelation()
        .withId(existing.getId())
        .withTerm(existing.getTerm())
        .withRelationType(validatedRelationType)
        .withProvenance(
            Objects.requireNonNullElse(request.getProvenance(), existing.getProvenance()))
        .withStatus(Objects.requireNonNullElse(request.getStatus(), existing.getStatus()))
        .withCreatedBy(existing.getCreatedBy())
        .withCreatedAt(existing.getCreatedAt());
  }
}
