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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.asType;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.createInversePair;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.createTerm;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.createType;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.deleteType;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.getType;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.getTypeByName;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.importInversePair;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.relate;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.relationReads;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.relationTypeName;
import static org.openmetadata.it.util.RelationshipTypeTestSupport.relationTypesTowards;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.RelationshipTypeTestSupport.Reply;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v210.RelationshipTypeReferenceRepair;

/**
 * Before the delete was guarded, a relationship type could be deleted while relations and other
 * types still used it, and their reads failed with 400. The 2.1.0 migration undeletes or recreates
 * those types.
 */
// Isolated: the repair sweeps every relationship type and clears the shared entity caches.
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class RelationshipTypeReferenceRepairMigrationIT {

  @AfterEach
  void cleanup(TestNamespace ns) {
    NamespaceCleanup.deleteRoots(ns.drainTrackedRoots());
  }

  @Test
  void aSoftDeletedTypeStillInUseIsUndeleted(TestNamespace ns) {
    Glossary glossary = GlossaryTestFactory.createWithName(ns, ns.uniqueShortId());
    RelationshipType cites = createType(relationTypeName(ns, "cites"), null);
    UUID paper = createTerm(glossary, ns.shortPrefix("paper"));
    UUID source = createTerm(glossary, ns.shortPrefix("source"));
    assertEquals(200, relate(paper, source, cites.getName()).status());
    softDeleteAsMainDid(cites);
    assertSomeFail(relationReads(glossary, paper, source));

    repair();

    RelationshipType restored = asType(getType(cites.getId()));
    assertFalse(restored.getDeleted());
    assertEquals(cites.getRdfPredicate(), restored.getRdfPredicate());
    assertAllSucceed(relationReads(glossary, paper, source));
    assertEquals(400, deleteType(cites.getId(), true).status(), "still in use, so still guarded");
  }

  @Test
  void aHardDeletedInverseIsRecreatedAsADeprecatedPlaceholder(TestNamespace ns) {
    Glossary glossary = GlossaryTestFactory.createWithName(ns, ns.uniqueShortId());
    List<RelationshipType> pair =
        createInversePair(relationTypeName(ns, "hasPart"), relationTypeName(ns, "partOf"));
    RelationshipType owner = pair.getFirst();
    RelationshipType inverse = pair.getLast();
    UUID whole = createTerm(glossary, ns.shortPrefix("whole"));
    UUID part = createTerm(glossary, ns.shortPrefix("part"));
    assertEquals(200, relate(whole, part, owner.getName()).status());
    hardDeleteAsMainDid(inverse);
    assertSomeFail(relationReads(glossary, whole, part));

    repair();

    RelationshipType placeholder = asType(getTypeByName(inverse.getName()));
    assertEquals(inverse.getId(), placeholder.getId());
    assertEquals(EntityStatus.DEPRECATED, placeholder.getEntityStatus());
    assertFalse(placeholder.getSystemDefined());
    assertEquals(owner.getId(), placeholder.getInverse().getId());
    assertTrue(
        placeholder.getDescription().contains(owner.getName()), placeholder.getDescription());
    assertAllSucceed(relationReads(glossary, whole, part));
  }

  @Test
  void aHardDeletedImportedInverseIsRecreatedAndRelationsReadAsBefore(TestNamespace ns) {
    Glossary glossary = GlossaryTestFactory.createWithName(ns, ns.uniqueShortId());
    String first = relationTypeName(ns, "contains");
    String second = relationTypeName(ns, "containedIn");
    List<UUID> terms = importInversePair(glossary, first, second);
    RelationshipType inverse = asType(getTypeByName(second));
    List<String> fromWhole = relationTypesTowards(terms.getFirst(), terms.getLast());
    List<String> fromPart = relationTypesTowards(terms.getLast(), terms.getFirst());
    hardDeleteAsMainDid(inverse);
    assertSomeFail(relationReads(glossary, terms.getFirst(), terms.getLast()));

    repair();

    RelationshipType placeholder = asType(getTypeByName(second));
    assertEquals(inverse.getId(), placeholder.getId());
    assertEquals(first, placeholder.getInverse().getName());
    assertAllSucceed(relationReads(glossary, terms.getFirst(), terms.getLast()));
    assertEquals(fromWhole, relationTypesTowards(terms.getFirst(), terms.getLast()));
    assertEquals(fromPart, relationTypesTowards(terms.getLast(), terms.getFirst()));
  }

  @Test
  void aSecondRunChangesNothing(TestNamespace ns) {
    RelationshipType cites = createType(relationTypeName(ns, "cited"), null);
    RelationshipType owner = createType(relationTypeName(ns, "citedBy"), cites.getName());
    softDeleteAsMainDid(cites);
    repair();
    RelationshipType afterFirst = asType(getType(cites.getId()));

    repair();

    RelationshipType afterSecond = asType(getType(cites.getId()));
    assertEquals(afterFirst.getUpdatedAt(), afterSecond.getUpdatedAt());
    assertFalse(afterSecond.getDeleted());
    assertEquals(200, deleteType(owner.getId(), true).status());
    assertEquals(200, deleteType(cites.getId(), true).status());
  }

  /** Stores the type as main's unguarded soft delete left it. */
  private static void softDeleteAsMainDid(RelationshipType type) {
    CollectionDAO dao = Entity.getCollectionDAO();
    RelationshipType stored = dao.relationshipTypeDAO().findEntityById(type.getId(), Include.ALL);
    stored.setDeleted(true);
    dao.relationshipTypeDAO().update(stored);
    EntityRepository.invalidateCacheForEntity(
        Entity.RELATIONSHIP_TYPE, type.getId(), type.getFullyQualifiedName());
  }

  /** Removes the type's row as main's unguarded hard delete did. */
  private static void hardDeleteAsMainDid(RelationshipType type) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate("DELETE FROM relationship_type_entity WHERE id = :id")
                    .bind("id", type.getId().toString())
                    .execute());
    EntityRepository.invalidateCacheForEntity(
        Entity.RELATIONSHIP_TYPE, type.getId(), type.getFullyQualifiedName());
  }

  private static void repair() {
    ConnectionType engine =
        "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"))
            ? ConnectionType.MYSQL
            : ConnectionType.POSTGRES;
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                RelationshipTypeReferenceRepair.repair(handle, engine, Entity.getCollectionDAO()));
    EntityRepository.CACHE_WITH_ID.invalidateAll();
    EntityRepository.CACHE_WITH_NAME.invalidateAll();
  }

  private static void assertSomeFail(List<Reply> replies) {
    assertTrue(
        replies.stream().anyMatch(reply -> reply.status() == 400),
        "the damage reproduces main's failing reads: " + replies);
  }

  private static void assertAllSucceed(List<Reply> replies) {
    replies.forEach(reply -> assertEquals(200, reply.status(), reply.message()));
  }
}
