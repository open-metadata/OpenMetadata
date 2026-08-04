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

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologySourceProvenance;

final class OntologyStructuralTermContext {
  private OntologyStructuralTermContext() {}

  static GlossaryTerm requireTerm(final List<GlossaryTerm> context, final UUID termId) {
    return context.stream()
        .filter(term -> term.getId().equals(termId))
        .findFirst()
        .orElseThrow(() -> new BadRequestException("Structural merge term is outside the context"));
  }

  static EntityReference targetParent(final UUID sourceParentId, final List<GlossaryTerm> context) {
    final EntityReference parent =
        sourceParentId == null
            ? null
            : requireTargetForSource(context, sourceParentId).getEntityReference();
    return parent;
  }

  static GlossaryTerm requireTargetForSource(
      final List<GlossaryTerm> context, final UUID sourceTermId) {
    return context.stream()
        .filter(term -> representsSource(term, sourceTermId))
        .findFirst()
        .orElseThrow(
            () ->
                new BadRequestException(
                    "Structural merge context is missing source term '" + sourceTermId + "'"));
  }

  private static boolean representsSource(final GlossaryTerm target, final UUID sourceTermId) {
    final OntologySourceProvenance provenance = target.getOntologySource();
    return target.getId().equals(sourceTermId)
        || (provenance != null
            && provenance.getSourceTerm() != null
            && sourceTermId.equals(provenance.getSourceTerm().getId()));
  }
}
