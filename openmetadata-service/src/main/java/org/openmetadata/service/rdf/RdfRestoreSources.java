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
package org.openmetadata.service.rdf;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.rdf.RdfEntityLiveness.Endpoint;
import org.openmetadata.service.util.FullyQualifiedName;

/** Reads a restore plan's sources from the metadata database. */
final class RdfRestoreSources implements RdfRestorePlanner.Sources {
  private static final String RELATED_TERMS = "relatedTerms";
  private final CollectionDAO dao;

  RdfRestoreSources(final CollectionDAO dao) {
    this.dao = dao;
  }

  @Override
  public List<EntityRelationshipObject> relationshipsOf(
      final String entityType, final List<UUID> entityIds) {
    final List<String> ids = entityIds.stream().map(UUID::toString).toList();
    final List<EntityRelationshipObject> rows =
        new ArrayList<>(
            dao.relationshipDAO()
                .findToBatchWithRelations(ids, entityType, RdfRelationshipScope.ALL_RELATIONSHIPS));
    rows.addAll(
        dao.relationshipDAO()
            .findFromBatchWithRelations(ids, entityType, RdfRelationshipScope.ALL_RELATIONSHIPS));
    return rows;
  }

  @Override
  public Set<Endpoint> labelledEntities(final String labelType, final List<UUID> labelIds) {
    final Set<String> targetHashes = new LinkedHashSet<>();
    for (final EntityReference label :
        Entity.getEntityRepository(labelType).getDao().findReferencesByIds(labelIds, Include.ALL)) {
      targetHashes.addAll(dao.tagUsageDAO().getTargetFQNHashForTag(label.getFullyQualifiedName()));
    }
    return entitiesOwningTargets(targetHashes);
  }

  /**
   * A label's target is an entity or one of its fields, such as a table column, and is stored as a
   * hash only. FQN hashes hash each name part separately, so a field's owner is found by trimming
   * trailing parts until some entity type has that hash; a deleted owner still matches, so the walk
   * stops at it rather than reaching its live parent.
   */
  private static Set<Endpoint> entitiesOwningTargets(final Set<String> targetHashes) {
    final List<EntityDAO<?>> daos = labelledEntityDaos();
    final Set<Endpoint> owners = new LinkedHashSet<>();
    Set<String> pending = targetHashes;
    while (!pending.isEmpty()) {
      final Set<String> matched = new HashSet<>();
      for (final EntityDAO<?> entityDao : daos) {
        collectOwners(entityDao, pending, matched, owners);
      }
      pending = parentHashes(pending, matched);
    }
    return owners;
  }

  private static void collectOwners(
      final EntityDAO<?> entityDao,
      final Set<String> hashes,
      final Set<String> matched,
      final Set<Endpoint> owners) {
    final String entityType = Entity.getEntityTypeFromClass(entityDao.getEntityClass());
    for (final EntityReference owner :
        entityDao.findReferencesByNameHashes(List.copyOf(hashes), Include.ALL)) {
      matched.add(FullyQualifiedName.buildHash(owner.getFullyQualifiedName()));
      if (!Boolean.TRUE.equals(owner.getDeleted())) {
        owners.add(new Endpoint(entityType, owner.getId()));
      }
    }
  }

  private static Set<String> parentHashes(final Set<String> hashes, final Set<String> matched) {
    final Set<String> parents = new LinkedHashSet<>();
    for (final String hash : hashes) {
      final int lastSeparator = hash.lastIndexOf(Entity.SEPARATOR);
      if (!matched.contains(hash) && lastSeparator > 0) {
        parents.add(hash.substring(0, lastSeparator));
      }
    }
    return parents;
  }

  private static List<EntityDAO<?>> labelledEntityDaos() {
    return Entity.getEntityList().stream()
        .filter(RdfRelationshipScope::isProjectedEndpoint)
        .filter(type -> Entity.hasEntityRepository(type) && !Entity.isTimeSeriesEntity(type))
        .<EntityDAO<?>>map(type -> Entity.getEntityRepository(type).getDao())
        .toList();
  }

  @Override
  public List<RdfRestorePlanner.GlossaryRelation> glossaryRelations(
      final Collection<UUID> termIds) {
    final List<EntityReference> references =
        termIds.stream()
            .map(id -> new EntityReference().withType(Entity.GLOSSARY_TERM).withId(id))
            .toList();
    final List<GlossaryTerm> terms =
        Entity.getEntities(references, RELATED_TERMS, Include.NON_DELETED);
    final List<RdfRestorePlanner.GlossaryRelation> relations = new ArrayList<>();
    for (final GlossaryTerm term : terms) {
      for (final TermRelation related : relatedTerms(term)) {
        relations.add(
            new RdfRestorePlanner.GlossaryRelation(
                term.getId(), related.getTerm().getId(), related.getRelationType()));
      }
    }
    return relations;
  }

  private static List<TermRelation> relatedTerms(final GlossaryTerm term) {
    return listOrEmpty(term.getRelatedTerms()).stream()
        .filter(relation -> relation.getTerm() != null && relation.getTerm().getId() != null)
        .toList();
  }
}
