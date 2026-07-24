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

import jakarta.ws.rs.core.UriInfo;
import java.time.Clock;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.RelationshipTypeRepository;

/** Keeps the deprecated settings write endpoint compatible during the 2.0 transition. */
public final class LegacyRelationshipTypeSynchronizer {
  private final RelationshipTypeRepository repository;
  private final LegacyRelationshipTypeMapper mapper;

  public LegacyRelationshipTypeSynchronizer(final RelationshipTypeRepository repository) {
    this(repository, new LegacyRelationshipTypeMapper(Clock.systemUTC()));
  }

  LegacyRelationshipTypeSynchronizer(
      final RelationshipTypeRepository repository, final LegacyRelationshipTypeMapper mapper) {
    this.repository = repository;
    this.mapper = mapper;
  }

  public void synchronize(
      final GlossaryTermRelationSettings previous,
      final GlossaryTermRelationSettings updated,
      final UriInfo uriInfo,
      final String updatedBy) {
    final List<RelationshipType> relationshipTypes = mapper.map(updated, updatedBy);
    relationshipTypes.forEach(type -> upsert(uriInfo, updatedBy, type));
    removedNames(previous, updated).forEach(name -> delete(updatedBy, name));
  }

  private void upsert(
      final UriInfo uriInfo, final String updatedBy, final RelationshipType relationshipType) {
    final RelationshipType existing =
        repository.findByNameOrNull(relationshipType.getName(), Include.ALL);
    if (existing != null) {
      relationshipType.setId(existing.getId());
      relationshipType.setSystemDefined(existing.getSystemDefined());
      relationshipType.setProvider(existing.getProvider());
      relationshipType.setOwners(existing.getOwners());
      relationshipType.setReviewers(existing.getReviewers());
    }
    repository.createOrUpdate(uriInfo, relationshipType, updatedBy);
  }

  private void delete(final String updatedBy, final String name) {
    final RelationshipType existing = repository.findByNameOrNull(name, Include.ALL);
    if (existing != null && !Boolean.TRUE.equals(existing.getSystemDefined())) {
      repository.delete(updatedBy, existing.getId(), false, true);
    }
  }

  private static Set<String> removedNames(
      final GlossaryTermRelationSettings previous, final GlossaryTermRelationSettings updated) {
    final Set<String> updatedNames = names(updated);
    return names(previous).stream()
        .filter(name -> !updatedNames.contains(name))
        .collect(Collectors.toUnmodifiableSet());
  }

  private static Set<String> names(final GlossaryTermRelationSettings settings) {
    final List<GlossaryTermRelationType> relationTypes =
        settings == null ? List.of() : listOrEmpty(settings.getRelationTypes());
    return relationTypes.stream()
        .map(GlossaryTermRelationType::getName)
        .collect(Collectors.toUnmodifiableSet());
  }
}
