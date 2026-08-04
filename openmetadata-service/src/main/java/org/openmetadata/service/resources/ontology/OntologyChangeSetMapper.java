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

package org.openmetadata.service.resources.ontology;

import java.util.List;
import org.openmetadata.schema.api.data.CreateOntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyChangeSetState;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public final class OntologyChangeSetMapper
    implements EntityMapper<OntologyChangeSet, CreateOntologyChangeSet> {
  @Override
  public OntologyChangeSet createToEntity(
      final CreateOntologyChangeSet request, final String user) {
    final List<EntityReference> glossaries =
        request.getGlossaries().stream()
            .map(fqn -> Entity.getEntityReferenceByName(Entity.GLOSSARY, fqn, Include.NON_DELETED))
            .toList();
    return copy(new OntologyChangeSet(), request, user)
        .withGlossaries(glossaries)
        .withState(OntologyChangeSetState.DRAFT)
        .withOperations(request.getOperations())
        .withUndoCursor(request.getOperations() == null ? 0 : request.getOperations().size())
        .withProvider(request.getProvider());
  }
}
