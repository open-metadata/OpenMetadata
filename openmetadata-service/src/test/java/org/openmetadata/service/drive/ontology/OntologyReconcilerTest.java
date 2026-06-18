/*
 * Copyright 2024 Collate.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package org.openmetadata.service.drive.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.configuration.AIDeletionPolicy;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetricExpressionLanguage;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.MetricRepository;
import org.openmetadata.service.util.EntityUtil;

@ExtendWith(MockitoExtension.class)
class OntologyReconcilerTest {

  @Mock GlossaryTermRepository termRepo;
  @Mock MetricRepository metricRepo;
  @Mock GlossaryRepository glossaryRepo;

  private static final String BOT = "ontology-bot";

  private final ContextMemory memory = new ContextMemory().withId(UUID.randomUUID()).withName("m1");

  @BeforeEach
  void stubEmptyEdgesAndFields() {
    lenient().when(termRepo.getFields(anyString())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
    lenient().when(metricRepo.getFields(anyString())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
    lenient().when(termRepo.getEntityClass()).thenReturn(GlossaryTerm.class);
    lenient().when(metricRepo.getEntityClass()).thenReturn(Metric.class);
    stubFindFrom(termRepo, Relationship.DERIVED_FROM, Entity.GLOSSARY_TERM, List.of());
    stubFindFrom(metricRepo, Relationship.DERIVED_FROM, Entity.METRIC, List.of());
    stubFindFrom(termRepo, Relationship.RELATED_TO, Entity.GLOSSARY_TERM, List.of());
    stubFindFrom(metricRepo, Relationship.RELATED_TO, Entity.METRIC, List.of());
  }

  private void stubFindFrom(
      EntityRepository<?> repo,
      Relationship relationship,
      String fromType,
      List<EntityReference> result) {
    lenient()
        .when(repo.findFrom(memory.getId(), Entity.CONTEXT_MEMORY, relationship, fromType))
        .thenReturn(result);
  }

  private OntologyReconciler reconciler() {
    return new OntologyReconciler(termRepo, metricRepo, glossaryRepo);
  }

  private OntologyVerdict skip() {
    return new OntologyVerdict(
        OntologyAction.SKIP, null, null, null, null, null, null, null, null, null);
  }

  private void echoTermOnCreate() {
    when(termRepo.createInternal(any(GlossaryTerm.class)))
        .thenAnswer(inv -> ((GlossaryTerm) inv.getArgument(0)).withId(UUID.randomUUID()));
  }

  private EntityReference ref(String name, String type) {
    return new EntityReference().withId(UUID.randomUUID()).withName(name).withType(type);
  }

  @Test
  void createTermInExistingGlossarySetsAutomationProviderAndDerivedFromEdge() {
    Glossary existingGlossary = new Glossary().withId(UUID.randomUUID()).withName("Business");
    when(glossaryRepo.findByNameOrNull("Business", Include.NON_DELETED))
        .thenReturn(existingGlossary);
    echoTermOnCreate();
    OntologyVerdict term =
        new OntologyVerdict(
            OntologyAction.CREATE,
            "Business",
            null,
            null,
            "Churn",
            "Churn",
            "Customer churn",
            null,
            null,
            null);

    OntologyReconciler.ReconcileResult result =
        reconciler().reconcile(memory, new OntologyDerivation(term, skip()));

    assertEquals(1, result.created());
    ArgumentCaptor<GlossaryTerm> captor = ArgumentCaptor.forClass(GlossaryTerm.class);
    verify(termRepo).createInternal(captor.capture());
    GlossaryTerm created = captor.getValue();
    assertEquals(ProviderType.AUTOMATION, created.getProvider());
    assertEquals("Churn", created.getName());
    assertEquals(BOT, created.getUpdatedBy());
    assertEquals(existingGlossary.getId(), created.getGlossary().getId());
    verify(glossaryRepo, never()).createInternal(any());
    verify(termRepo)
        .addRelationship(
            eq(created.getId()),
            eq(memory.getId()),
            eq(Entity.GLOSSARY_TERM),
            eq(Entity.CONTEXT_MEMORY),
            eq(Relationship.DERIVED_FROM),
            eq(false));
  }

  @Test
  void createTermMintsGlossaryWhenNoneFits() {
    when(glossaryRepo.createInternal(any(Glossary.class)))
        .thenAnswer(inv -> ((Glossary) inv.getArgument(0)).withId(UUID.randomUUID()));
    echoTermOnCreate();
    OntologyVerdict term =
        new OntologyVerdict(
            OntologyAction.CREATE,
            null,
            "Finance",
            "Finance concepts",
            "ARR",
            "ARR",
            "Annual recurring revenue",
            null,
            null,
            null);

    OntologyReconciler.ReconcileResult result =
        reconciler().reconcile(memory, new OntologyDerivation(term, skip()));

    assertEquals(1, result.created());
    ArgumentCaptor<Glossary> glossaryCaptor = ArgumentCaptor.forClass(Glossary.class);
    verify(glossaryRepo).createInternal(glossaryCaptor.capture());
    Glossary minted = glossaryCaptor.getValue();
    assertEquals("Finance", minted.getName());
    assertEquals(ProviderType.AUTOMATION, minted.getProvider());
    assertEquals(BOT, minted.getUpdatedBy());
    ArgumentCaptor<GlossaryTerm> termCaptor = ArgumentCaptor.forClass(GlossaryTerm.class);
    verify(termRepo).createInternal(termCaptor.capture());
    assertEquals(minted.getId(), termCaptor.getValue().getGlossary().getId());
  }

  @Test
  void createMetricSetsAutomationProviderExpressionAndDerivedFromEdge() {
    when(metricRepo.createInternal(any(Metric.class)))
        .thenAnswer(inv -> ((Metric) inv.getArgument(0)).withId(UUID.randomUUID()));
    OntologyVerdict metric =
        new OntologyVerdict(
            OntologyAction.CREATE,
            null,
            null,
            null,
            "churn_rate",
            "Churn Rate",
            "Rate of churn",
            "COUNT",
            "COUNT",
            "SELECT count(*) FROM churn");

    OntologyReconciler.ReconcileResult result =
        reconciler().reconcile(memory, new OntologyDerivation(skip(), metric));

    assertEquals(1, result.created());
    ArgumentCaptor<Metric> captor = ArgumentCaptor.forClass(Metric.class);
    verify(metricRepo).createInternal(captor.capture());
    Metric created = captor.getValue();
    assertEquals(ProviderType.AUTOMATION, created.getProvider());
    assertEquals("churn_rate", created.getName());
    assertEquals(BOT, created.getUpdatedBy());
    assertEquals(MetricExpressionLanguage.SQL, created.getMetricExpression().getLanguage());
    assertEquals("SELECT count(*) FROM churn", created.getMetricExpression().getCode());
    verify(metricRepo)
        .addRelationship(
            eq(created.getId()),
            eq(memory.getId()),
            eq(Entity.METRIC),
            eq(Entity.CONTEXT_MEMORY),
            eq(Relationship.DERIVED_FROM),
            eq(false));
  }

  @Test
  void reuseTermAddsRelatedToEdgeNoCreate() {
    GlossaryTerm existing =
        new GlossaryTerm()
            .withId(UUID.randomUUID())
            .withName("Churn")
            .withProvider(ProviderType.USER);
    when(termRepo.findByNameOrNull("Business.Churn", Include.NON_DELETED)).thenReturn(existing);
    OntologyVerdict term =
        new OntologyVerdict(
            OntologyAction.REUSE, "Business.Churn", null, null, null, null, null, null, null, null);

    OntologyReconciler.ReconcileResult result =
        reconciler().reconcile(memory, new OntologyDerivation(term, skip()));

    assertEquals(0, result.created());
    assertEquals(1, result.reused());
    verify(termRepo, never()).createInternal(any());
    verify(termRepo)
        .addRelationship(
            eq(memory.getId()),
            eq(existing.getId()),
            eq(Entity.CONTEXT_MEMORY),
            eq(Entity.GLOSSARY_TERM),
            eq(Relationship.RELATED_TO),
            eq(false));
  }

  @Test
  void reuseUnresolvedFqnFallsBackToSkip() {
    when(termRepo.findByNameOrNull("Ghost.Term", Include.NON_DELETED)).thenReturn(null);
    OntologyVerdict term =
        new OntologyVerdict(
            OntologyAction.REUSE, "Ghost.Term", null, null, null, null, null, null, null, null);

    OntologyReconciler.ReconcileResult result =
        reconciler().reconcile(memory, new OntologyDerivation(term, skip()));

    assertEquals(0, result.created());
    assertEquals(0, result.reused());
    verify(termRepo, never()).addRelationship(any(), any(), any(), any(), any(), eq(false));
  }

  @Test
  void skipBothAxesIsNoOp() {
    OntologyReconciler.ReconcileResult result =
        reconciler().reconcile(memory, new OntologyDerivation(skip(), skip()));

    assertEquals(0, result.created());
    assertEquals(0, result.reused());
    assertEquals(0, result.retired());
    verify(termRepo, never()).createInternal(any());
    verify(metricRepo, never()).createInternal(any());
  }

  @Test
  void reDeriveRetiresStaleOwnedTerm() {
    EntityReference staleRef = ref("OldTerm", Entity.GLOSSARY_TERM);
    stubFindFrom(termRepo, Relationship.DERIVED_FROM, Entity.GLOSSARY_TERM, List.of(staleRef));
    GlossaryTerm stale =
        new GlossaryTerm()
            .withId(staleRef.getId())
            .withName("OldTerm")
            .withProvider(ProviderType.AUTOMATION);
    when(termRepo.get(isNull(), eq(staleRef.getId()), any(EntityUtil.Fields.class)))
        .thenReturn(stale);

    OntologyReconciler.ReconcileResult result =
        reconciler().reconcile(memory, new OntologyDerivation(skip(), skip()));

    assertEquals(1, result.retired());
    verify(termRepo).delete(BOT, staleRef.getId(), false, true);
  }

  @Test
  void reDeriveSkipsHumanAdoptedTerm() {
    EntityReference adoptedRef = ref("Adopted", Entity.GLOSSARY_TERM);
    stubFindFrom(termRepo, Relationship.DERIVED_FROM, Entity.GLOSSARY_TERM, List.of(adoptedRef));
    GlossaryTerm adopted =
        new GlossaryTerm()
            .withId(adoptedRef.getId())
            .withName("Adopted")
            .withProvider(ProviderType.USER);
    when(termRepo.get(isNull(), eq(adoptedRef.getId()), any(EntityUtil.Fields.class)))
        .thenReturn(adopted);

    OntologyReconciler.ReconcileResult result =
        reconciler().reconcile(memory, new OntologyDerivation(skip(), skip()));

    assertEquals(0, result.retired());
    verify(termRepo, never()).delete(any(), any(), eq(false), eq(true));
    verify(termRepo, never()).update(any(), any(), any(), any());
  }

  @Test
  void onMemoryDeletedCascadeHardDeletesOwnedTerm() {
    EntityReference ownedRef = ref("Owned", Entity.GLOSSARY_TERM);
    stubFindFrom(termRepo, Relationship.DERIVED_FROM, Entity.GLOSSARY_TERM, List.of(ownedRef));
    GlossaryTerm owned =
        new GlossaryTerm().withId(ownedRef.getId()).withProvider(ProviderType.AUTOMATION);
    when(termRepo.get(isNull(), eq(ownedRef.getId()), any(EntityUtil.Fields.class)))
        .thenReturn(owned);

    reconciler().onMemoryDeleted(memory, true, AIDeletionPolicy.CASCADE);

    verify(termRepo).delete(BOT, ownedRef.getId(), false, true);
  }

  @Test
  void onMemoryDeletedOrphanFlipsProviderToUserAndDropsEdge() {
    EntityReference ownedRef = ref("Owned", Entity.GLOSSARY_TERM);
    stubFindFrom(termRepo, Relationship.DERIVED_FROM, Entity.GLOSSARY_TERM, List.of(ownedRef));
    GlossaryTerm owned =
        new GlossaryTerm().withId(ownedRef.getId()).withProvider(ProviderType.AUTOMATION);
    when(termRepo.get(isNull(), eq(ownedRef.getId()), any(EntityUtil.Fields.class)))
        .thenReturn(owned);

    reconciler().onMemoryDeleted(memory, false, AIDeletionPolicy.ORPHAN);

    ArgumentCaptor<GlossaryTerm> captor = ArgumentCaptor.forClass(GlossaryTerm.class);
    verify(termRepo).update(isNull(), eq(owned), captor.capture(), eq(BOT));
    assertEquals(ProviderType.USER, captor.getValue().getProvider());
    verify(termRepo)
        .deleteRelationship(
            ownedRef.getId(),
            Entity.GLOSSARY_TERM,
            memory.getId(),
            Entity.CONTEXT_MEMORY,
            Relationship.DERIVED_FROM);
    verify(termRepo, never()).delete(any(), any(), eq(false), eq(true));
  }

  @Test
  void onMemoryDeletedDeprecateSetsStatusAndDropsEdge() {
    EntityReference ownedRef = ref("Owned", Entity.METRIC);
    stubFindFrom(metricRepo, Relationship.DERIVED_FROM, Entity.METRIC, List.of(ownedRef));
    Metric owned = new Metric().withId(ownedRef.getId()).withProvider(ProviderType.AUTOMATION);
    when(metricRepo.get(isNull(), eq(ownedRef.getId()), any(EntityUtil.Fields.class)))
        .thenReturn(owned);

    reconciler().onMemoryDeleted(memory, false, AIDeletionPolicy.DEPRECATE);

    ArgumentCaptor<Metric> captor = ArgumentCaptor.forClass(Metric.class);
    verify(metricRepo).update(isNull(), eq(owned), captor.capture(), eq(BOT));
    assertEquals(EntityStatus.DEPRECATED, captor.getValue().getEntityStatus());
    verify(metricRepo)
        .deleteRelationship(
            ownedRef.getId(),
            Entity.METRIC,
            memory.getId(),
            Entity.CONTEXT_MEMORY,
            Relationship.DERIVED_FROM);
  }

  @Test
  void onMemoryDeletedDropsReusedRelatedToEdgesNeverTouchingTarget() {
    EntityReference reusedRef = ref("Reused", Entity.GLOSSARY_TERM);
    stubFindFrom(termRepo, Relationship.RELATED_TO, Entity.GLOSSARY_TERM, List.of(reusedRef));

    reconciler().onMemoryDeleted(memory, true, AIDeletionPolicy.CASCADE);

    verify(termRepo)
        .deleteRelationship(
            memory.getId(),
            Entity.CONTEXT_MEMORY,
            reusedRef.getId(),
            Entity.GLOSSARY_TERM,
            Relationship.RELATED_TO);
    verify(termRepo, never()).delete(any(), any(), eq(false), eq(true));
    verify(termRepo, never()).get(any(), any(), any(EntityUtil.Fields.class));
  }

  @Test
  void unknownActionTreatedAsNoOp() {
    OntologyVerdict garbage =
        new OntologyVerdict("WAT", null, null, null, null, null, null, null, null, null);

    OntologyReconciler.ReconcileResult result =
        reconciler().reconcile(memory, new OntologyDerivation(garbage, skip()));

    assertEquals(0, result.created());
    assertEquals(0, result.reused());
    verify(termRepo, never()).createInternal(any());
  }
}
