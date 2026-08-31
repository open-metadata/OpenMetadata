/*
 *  Copyright 2024 Collate.
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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * Inheritance must reflect the parent's current state, not a snapshot taken earlier on the same
 * thread.
 *
 * <p>Parent lookups used to be memoized in a {@code static ThreadLocal} on {@code EntityRepository}
 * that had no TTL, no size bound, and no eviction, and was cleared only by the JAX-RS response
 * filter. Any pool that never serves an HTTP request — the Quartz change-event consumer that runs
 * governance workflows, Flowable's async job executor — therefore kept the first snapshot forever.
 * In production that meant a glossary read before its reviewer was added kept reporting no
 * reviewers, so the approval workflow created no task and left terms in Draft until the pod
 * restarted.
 *
 * <p>{@link #inheritance_reflectsParentMutation_onRepeatedReadsFromOneThread()} fails against that
 * memoization: the second read returns the stale parent.
 */
class EntityRepositoryInheritanceParentTest {

  private CollectionDAO daoCollection;
  private ParentTrackingPipelineRepo repository;
  private Pipeline parent;

  /** Serves a single mutable parent and counts how many times inheritance asked for it. */
  private static class ParentTrackingPipelineRepo extends EntityRepository<Pipeline> {
    private final Pipeline parent;
    private int parentLoads;

    ParentTrackingPipelineRepo(CollectionDAO.PipelineDAO dao, Pipeline parent) {
      super("pipelines", Entity.PIPELINE, Pipeline.class, dao, "domains", "domains");
      this.parent = parent;
    }

    @Override
    public EntityReference getParentReference(Pipeline entity) {
      return parent.getEntityReference();
    }

    /**
     * Returns a fresh snapshot each time, as a real read does. Handing back the same mutable
     * instance would let a memoized reference appear up to date and hide staleness.
     */
    @Override
    public EntityInterface getParentEntity(Pipeline entity, String fields) {
      parentLoads++;
      return new Pipeline()
          .withId(parent.getId())
          .withName(parent.getName())
          .withFullyQualifiedName(parent.getFullyQualifiedName())
          .withDomains(parent.getDomains() == null ? null : new ArrayList<>(parent.getDomains()));
    }

    @Override
    protected void setFields(Pipeline entity, Fields fields, RelationIncludes r) {}

    @Override
    protected void clearFields(Pipeline entity, Fields fields) {}

    @Override
    protected void prepare(Pipeline entity, boolean update) {}

    @Override
    protected void storeEntity(Pipeline entity, boolean update) {}

    @Override
    protected void storeRelationships(Pipeline entity) {}
  }

  @BeforeEach
  void setUp() {
    daoCollection = mock(CollectionDAO.class);
    when(daoCollection.relationshipDAO())
        .thenReturn(mock(CollectionDAO.EntityRelationshipDAO.class));
    Entity.setCollectionDAO(daoCollection);

    parent =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("parent")
            .withFullyQualifiedName("parent")
            .withDomains(new ArrayList<>());
    repository = new ParentTrackingPipelineRepo(mock(CollectionDAO.PipelineDAO.class), parent);
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  void inheritance_reflectsParentMutation_onRepeatedReadsFromOneThread() {
    Fields domains = new Fields(Set.of(Entity.FIELD_DOMAINS));

    // First read on this thread: the parent has no domains yet, so nothing is inherited.
    Pipeline before = childPipeline();
    repository.setInheritedFields(before, domains);
    assertTrue(
        before.getDomains() == null || before.getDomains().isEmpty(),
        "Nothing to inherit before the parent has a domain");

    // The parent gains a domain — as a glossary gains a reviewer.
    EntityReference domain =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.DOMAIN)
            .withName("finance")
            .withFullyQualifiedName("finance");
    parent.setDomains(new ArrayList<>(List.of(domain)));

    // Second read on the SAME thread must see it. A memoized parent would still report none.
    Pipeline after = childPipeline();
    repository.setInheritedFields(after, domains);

    assertEquals(
        1,
        after.getDomains() == null ? 0 : after.getDomains().size(),
        "Second read on the same thread must reflect the parent's current domains, "
            + "not a snapshot cached during the first read");
    assertEquals("finance", after.getDomains().get(0).getFullyQualifiedName());
  }

  @Test
  void inheritance_loadsParentOnEveryRead_soNoStaleSnapshotCanSurvive() {
    Fields domains = new Fields(Set.of(Entity.FIELD_DOMAINS));

    repository.setInheritedFields(childPipeline(), domains);
    repository.setInheritedFields(childPipeline(), domains);

    assertEquals(
        2,
        repository.parentLoads,
        "Each read resolves the parent; memoizing it across reads is what made inherited "
            + "fields go stale on long-lived non-HTTP threads");
  }

  private Pipeline childPipeline() {
    return new Pipeline()
        .withId(UUID.randomUUID())
        .withName("child")
        .withFullyQualifiedName("child");
  }
}
