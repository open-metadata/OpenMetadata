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

package org.openmetadata.service.drive.memory;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
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
import org.openmetadata.schema.type.MetricType;
import org.openmetadata.schema.type.MetricUnitOfMeasurement;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.MetricRepository;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.MemoryOwnership;

@ExtendWith(MockitoExtension.class)
class MemoryReconcilerTest {

  @Mock GlossaryTermRepository termRepo;
  @Mock MetricRepository metricRepo;
  @Mock GlossaryRepository glossaryRepo;

  private static final String BOT = MemoryOwnership.MEMORY_BOT_NAME;

  private final ContextMemory memory = new ContextMemory().withId(UUID.randomUUID()).withName("m1");

  @BeforeEach
  void stubEmptyEdgesAndFields() {
    lenient().when(termRepo.getFields(anyString())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
    lenient().when(metricRepo.getFields(anyString())).thenReturn(EntityUtil.Fields.EMPTY_FIELDS);
    lenient().when(termRepo.getEntityClass()).thenReturn(GlossaryTerm.class);
    lenient().when(metricRepo.getEntityClass()).thenReturn(Metric.class);
    stubFindFrom(termRepo, Relationship.DERIVED_FROM, Entity.GLOSSARY_TERM, List.of());
    stubFindFrom(metricRepo, Relationship.DERIVED_FROM, Entity.METRIC, List.of());
    stubFindTo(termRepo, Relationship.RELATED_TO, Entity.GLOSSARY_TERM, List.of());
    stubFindTo(metricRepo, Relationship.RELATED_TO, Entity.METRIC, List.of());
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

  private void stubFindTo(
      EntityRepository<?> repo,
      Relationship relationship,
      String toType,
      List<EntityReference> result) {
    lenient()
        .when(repo.findTo(memory.getId(), Entity.CONTEXT_MEMORY, relationship, toType))
        .thenReturn(result);
  }

  private void stubFindFromAll(
      EntityRepository<?> repo,
      Relationship relationship,
      String fromType,
      List<EntityReference> result) {
    lenient()
        .when(
            repo.findFrom(
                memory.getId(), Entity.CONTEXT_MEMORY, relationship, fromType, Include.ALL))
        .thenReturn(result);
  }

  private MemoryReconciler reconciler() {
    return new MemoryReconciler(termRepo, metricRepo, glossaryRepo);
  }

  private MemoryVerdict skip() {
    return new MemoryVerdict(
        MemoryAction.SKIP, null, null, null, null, null, null, null, null, null);
  }

  private MemoryVerdict createMetric(String name) {
    return new MemoryVerdict(
        MemoryAction.CREATE, null, null, null, name, name, null, null, null, null);
  }

  private void echoMetricOnCreate() {
    when(metricRepo.createInternal(any(Metric.class)))
        .thenAnswer(inv -> ((Metric) inv.getArgument(0)).withId(UUID.randomUUID()));
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
    MemoryVerdict term =
        new MemoryVerdict(
            MemoryAction.CREATE,
            "Business",
            null,
            null,
            "Churn",
            "Churn",
            "Customer churn",
            null,
            null,
            null);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(memory, new MemoryDerivation(term, skip()), AIDeletionPolicy.CASCADE);

    assertEquals(1, result.createdTerms());
    assertEquals(0, result.createdMetrics());
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
    MemoryVerdict term =
        new MemoryVerdict(
            MemoryAction.CREATE,
            null,
            "Finance",
            "Finance concepts",
            "ARR",
            "ARR",
            "Annual recurring revenue",
            null,
            null,
            null);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(memory, new MemoryDerivation(term, skip()), AIDeletionPolicy.CASCADE);

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
  void createTermWiresTypedRelatedTerms() {
    Glossary glossary = new Glossary().withId(UUID.randomUUID()).withName("CustomerValue");
    when(glossaryRepo.findByNameOrNull("CustomerValue", Include.NON_DELETED)).thenReturn(glossary);
    echoTermOnCreate();
    GlossaryTerm related =
        new GlossaryTerm()
            .withId(UUID.randomUUID())
            .withName("BaseCustomerValue")
            .withFullyQualifiedName("CustomerValue.BaseCustomerValue");
    when(termRepo.findByNameOrNull("CustomerValue.EngagementWeightedCLV", Include.NON_DELETED))
        .thenReturn(null);
    when(termRepo.findByNameOrNull("CustomerValue.BaseCustomerValue", Include.NON_DELETED))
        .thenReturn(related);
    MemoryVerdict term =
        new MemoryVerdict(
            MemoryAction.CREATE,
            "CustomerValue",
            null,
            null,
            "EngagementWeightedCLV",
            "Engagement-Weighted CLV",
            "CLV adjusted by engagement tier",
            null,
            null,
            null,
            List.of(new MemoryRelation("CustomerValue.BaseCustomerValue", "calculatedFrom")));

    reconciler().reconcile(memory, new MemoryDerivation(term, skip()), AIDeletionPolicy.CASCADE);

    ArgumentCaptor<TermRelation> relationCaptor = ArgumentCaptor.forClass(TermRelation.class);
    verify(termRepo).addTermRelation(any(UUID.class), relationCaptor.capture());
    TermRelation wired = relationCaptor.getValue();
    assertEquals(related.getId(), wired.getTerm().getId());
    assertEquals("calculatedFrom", wired.getRelationType());
  }

  @Test
  void unknownRelationTypeFallsBackToRelatedTo() {
    Glossary glossary = new Glossary().withId(UUID.randomUUID()).withName("CustomerValue");
    when(glossaryRepo.findByNameOrNull("CustomerValue", Include.NON_DELETED)).thenReturn(glossary);
    echoTermOnCreate();
    GlossaryTerm related =
        new GlossaryTerm()
            .withId(UUID.randomUUID())
            .withName("BaseCustomerValue")
            .withFullyQualifiedName("CustomerValue.BaseCustomerValue");
    when(termRepo.findByNameOrNull("CustomerValue.EngagementWeightedCLV", Include.NON_DELETED))
        .thenReturn(null);
    when(termRepo.findByNameOrNull("CustomerValue.BaseCustomerValue", Include.NON_DELETED))
        .thenReturn(related);
    MemoryVerdict term =
        new MemoryVerdict(
            MemoryAction.CREATE,
            "CustomerValue",
            null,
            null,
            "EngagementWeightedCLV",
            "Engagement-Weighted CLV",
            "CLV adjusted by engagement tier",
            null,
            null,
            null,
            List.of(
                new MemoryRelation("CustomerValue.BaseCustomerValue", "isMagicallyDerivedFrom")));

    reconciler().reconcile(memory, new MemoryDerivation(term, skip()), AIDeletionPolicy.CASCADE);

    ArgumentCaptor<TermRelation> relationCaptor = ArgumentCaptor.forClass(TermRelation.class);
    verify(termRepo).addTermRelation(any(UUID.class), relationCaptor.capture());
    assertEquals("relatedTo", relationCaptor.getValue().getRelationType());
  }

  @Test
  void createTermPinsToSiblingGlossaryInsteadOfMintingNearDuplicate() {
    Glossary sibling = new Glossary().withId(UUID.randomUUID()).withName("Customer Analytics");
    when(glossaryRepo.findByNameOrNull("Customer Analytics", Include.NON_DELETED))
        .thenReturn(sibling);
    echoTermOnCreate();
    MemoryVerdict term =
        new MemoryVerdict(
            MemoryAction.CREATE,
            null,
            "Customer Metrics",
            "near-duplicate glossary the agent proposed",
            "Customer Tenure",
            "Customer Tenure",
            "Days since signup",
            null,
            null,
            null);
    MemoryContext ctx =
        new MemoryContext(List.of(), List.of(), List.of(), List.of(), "Customer Analytics");

    reconciler()
        .reconcile(
            memory, new MemoryDerivation(term, skip()), ctx, AIDeletionPolicy.CASCADE, true, true);

    ArgumentCaptor<GlossaryTerm> captor = ArgumentCaptor.forClass(GlossaryTerm.class);
    verify(termRepo).createInternal(captor.capture());
    assertEquals(sibling.getId(), captor.getValue().getGlossary().getId());
    verify(glossaryRepo, never()).createInternal(any());
  }

  @Test
  void hallucinatedRelatedTermFqnIsDroppedNotWired() {
    Glossary glossary = new Glossary().withId(UUID.randomUUID()).withName("Finance");
    when(glossaryRepo.findByNameOrNull("Finance", Include.NON_DELETED)).thenReturn(glossary);
    echoTermOnCreate();
    MemoryVerdict term =
        new MemoryVerdict(
            MemoryAction.CREATE,
            "Finance",
            null,
            null,
            "ARR",
            "ARR",
            "Annual recurring revenue",
            null,
            null,
            null,
            List.of(new MemoryRelation("Finance.Ghost", "synonym")));

    reconciler().reconcile(memory, new MemoryDerivation(term, skip()), AIDeletionPolicy.CASCADE);

    verify(termRepo, never()).addTermRelation(any(), any());
  }

  @Test
  void createMetricSetsAutomationProviderExpressionAndDerivedFromEdge() {
    when(metricRepo.createInternal(any(Metric.class)))
        .thenAnswer(inv -> ((Metric) inv.getArgument(0)).withId(UUID.randomUUID()));
    MemoryVerdict metric =
        new MemoryVerdict(
            MemoryAction.CREATE,
            null,
            null,
            null,
            "churn_rate",
            "Churn Rate",
            "Rate of churn",
            "COUNT",
            "COUNT",
            "SELECT count(*) FROM churn");

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(memory, new MemoryDerivation(skip(), metric), AIDeletionPolicy.CASCADE);

    assertEquals(0, result.createdTerms());
    assertEquals(1, result.createdMetrics());
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
    MemoryVerdict term =
        new MemoryVerdict(
            MemoryAction.REUSE, "Business.Churn", null, null, null, null, null, null, null, null);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(memory, new MemoryDerivation(term, skip()), AIDeletionPolicy.CASCADE);

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
    MemoryVerdict term =
        new MemoryVerdict(
            MemoryAction.REUSE, "Ghost.Term", null, null, null, null, null, null, null, null);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(memory, new MemoryDerivation(term, skip()), AIDeletionPolicy.CASCADE);

    assertEquals(0, result.created());
    assertEquals(0, result.reused());
    verify(termRepo, never()).addRelationship(any(), any(), any(), any(), any(), eq(false));
  }

  @Test
  void skipBothAxesIsNoOp() {
    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(memory, new MemoryDerivation(skip(), skip()), AIDeletionPolicy.CASCADE);

    assertEquals(0, result.created());
    assertEquals(0, result.reused());
    assertEquals(0, result.retired());
    verify(termRepo, never()).createInternal(any());
    verify(metricRepo, never()).createInternal(any());
  }

  @Test
  void allSkipVerdictNeverRetiresOwnedEntities() {
    EntityReference ownedTerm = ref("OwnedTerm", Entity.GLOSSARY_TERM);
    EntityReference ownedMetric = ref("OwnedMetric", Entity.METRIC);
    stubFindFrom(termRepo, Relationship.DERIVED_FROM, Entity.GLOSSARY_TERM, List.of(ownedTerm));
    stubFindFrom(metricRepo, Relationship.DERIVED_FROM, Entity.METRIC, List.of(ownedMetric));

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(memory, new MemoryDerivation(skip(), skip()), AIDeletionPolicy.CASCADE);

    assertEquals(0, result.created());
    assertEquals(0, result.reused());
    assertEquals(0, result.retired());
    verify(termRepo, never()).delete(any(), any(), eq(false), eq(true));
    verify(metricRepo, never()).delete(any(), any(), eq(false), eq(true));
    verify(termRepo, never()).deleteRelationship(any(), any(), any(), any(), any());
    verify(metricRepo, never()).deleteRelationship(any(), any(), any(), any(), any());
    verify(termRepo, never()).update(any(), any(), any(), any());
    verify(metricRepo, never()).update(any(), any(), any(), any());
    verify(termRepo, never()).get(any(), any(), any(EntityUtil.Fields.class));
    verify(metricRepo, never()).get(any(), any(), any(EntityUtil.Fields.class));
  }

  @Test
  void reDeriveCascadeHardDeletesStaleOwnedTerm() {
    echoMetricOnCreate();
    EntityReference staleRef = ref("OldTerm", Entity.GLOSSARY_TERM);
    stubFindFrom(termRepo, Relationship.DERIVED_FROM, Entity.GLOSSARY_TERM, List.of(staleRef));
    GlossaryTerm stale =
        new GlossaryTerm()
            .withId(staleRef.getId())
            .withName("OldTerm")
            .withProvider(ProviderType.AUTOMATION);
    when(termRepo.get(isNull(), eq(staleRef.getId()), any(EntityUtil.Fields.class)))
        .thenReturn(stale);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(
                memory,
                new MemoryDerivation(skip(), createMetric("churn_rate")),
                AIDeletionPolicy.CASCADE);

    assertEquals(1, result.retired());
    verify(termRepo).delete(BOT, staleRef.getId(), false, true);
  }

  @Test
  void reDeriveOrphanFlipsStaleOwnedTermToUserAndDropsEdge() {
    echoMetricOnCreate();
    EntityReference staleRef = ref("OldTerm", Entity.GLOSSARY_TERM);
    stubFindFrom(termRepo, Relationship.DERIVED_FROM, Entity.GLOSSARY_TERM, List.of(staleRef));
    GlossaryTerm stale =
        new GlossaryTerm()
            .withId(staleRef.getId())
            .withName("OldTerm")
            .withProvider(ProviderType.AUTOMATION);
    when(termRepo.get(isNull(), eq(staleRef.getId()), any(EntityUtil.Fields.class)))
        .thenReturn(stale);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(
                memory,
                new MemoryDerivation(skip(), createMetric("churn_rate")),
                AIDeletionPolicy.ORPHAN);

    assertEquals(1, result.retired());
    ArgumentCaptor<GlossaryTerm> captor = ArgumentCaptor.forClass(GlossaryTerm.class);
    verify(termRepo).update(isNull(), eq(stale), captor.capture(), eq(BOT));
    assertEquals(ProviderType.USER, captor.getValue().getProvider());
    verify(termRepo)
        .deleteRelationship(
            staleRef.getId(),
            Entity.GLOSSARY_TERM,
            memory.getId(),
            Entity.CONTEXT_MEMORY,
            Relationship.DERIVED_FROM);
    verify(termRepo, never()).delete(any(), any(), eq(false), eq(true));
  }

  @Test
  void reDeriveDeprecateSetsStaleOwnedTermStatusAndDropsEdge() {
    echoMetricOnCreate();
    EntityReference staleRef = ref("OldTerm", Entity.GLOSSARY_TERM);
    stubFindFrom(termRepo, Relationship.DERIVED_FROM, Entity.GLOSSARY_TERM, List.of(staleRef));
    GlossaryTerm stale =
        new GlossaryTerm()
            .withId(staleRef.getId())
            .withName("OldTerm")
            .withProvider(ProviderType.AUTOMATION);
    when(termRepo.get(isNull(), eq(staleRef.getId()), any(EntityUtil.Fields.class)))
        .thenReturn(stale);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(
                memory,
                new MemoryDerivation(skip(), createMetric("churn_rate")),
                AIDeletionPolicy.DEPRECATE);

    assertEquals(1, result.retired());
    ArgumentCaptor<GlossaryTerm> captor = ArgumentCaptor.forClass(GlossaryTerm.class);
    verify(termRepo).update(isNull(), eq(stale), captor.capture(), eq(BOT));
    assertEquals(EntityStatus.DEPRECATED, captor.getValue().getEntityStatus());
    verify(termRepo)
        .deleteRelationship(
            staleRef.getId(),
            Entity.GLOSSARY_TERM,
            memory.getId(),
            Entity.CONTEXT_MEMORY,
            Relationship.DERIVED_FROM);
    verify(termRepo, never()).delete(any(), any(), eq(false), eq(true));
  }

  @Test
  void reDeriveSkipsHumanAdoptedTerm() {
    echoMetricOnCreate();
    EntityReference adoptedRef = ref("Adopted", Entity.GLOSSARY_TERM);
    stubFindFrom(termRepo, Relationship.DERIVED_FROM, Entity.GLOSSARY_TERM, List.of(adoptedRef));
    GlossaryTerm adopted =
        new GlossaryTerm()
            .withId(adoptedRef.getId())
            .withName("Adopted")
            .withProvider(ProviderType.USER);
    when(termRepo.get(isNull(), eq(adoptedRef.getId()), any(EntityUtil.Fields.class)))
        .thenReturn(adopted);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(
                memory,
                new MemoryDerivation(skip(), createMetric("churn_rate")),
                AIDeletionPolicy.CASCADE);

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
    stubFindTo(termRepo, Relationship.RELATED_TO, Entity.GLOSSARY_TERM, List.of(reusedRef));

    reconciler().onMemoryDeleted(memory, true, AIDeletionPolicy.CASCADE);

    verify(termRepo)
        .findTo(
            memory.getId(), Entity.CONTEXT_MEMORY, Relationship.RELATED_TO, Entity.GLOSSARY_TERM);
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
  void reuseWriteAndMemoryDeleteReadAgreeOnRelatedToDirection() {
    GlossaryTerm existing =
        new GlossaryTerm()
            .withId(UUID.randomUUID())
            .withName("Churn")
            .withProvider(ProviderType.USER);
    when(termRepo.findByNameOrNull("Business.Churn", Include.NON_DELETED)).thenReturn(existing);
    MemoryVerdict term =
        new MemoryVerdict(
            MemoryAction.REUSE, "Business.Churn", null, null, null, null, null, null, null, null);

    reconciler().reconcile(memory, new MemoryDerivation(term, skip()), AIDeletionPolicy.CASCADE);

    ArgumentCaptor<UUID> fromId = ArgumentCaptor.forClass(UUID.class);
    ArgumentCaptor<UUID> toId = ArgumentCaptor.forClass(UUID.class);
    ArgumentCaptor<String> fromType = ArgumentCaptor.forClass(String.class);
    ArgumentCaptor<String> toType = ArgumentCaptor.forClass(String.class);
    verify(termRepo)
        .addRelationship(
            fromId.capture(),
            toId.capture(),
            fromType.capture(),
            toType.capture(),
            eq(Relationship.RELATED_TO),
            eq(false));

    assertEquals(memory.getId(), fromId.getValue());
    assertEquals(existing.getId(), toId.getValue());
    assertEquals(Entity.CONTEXT_MEMORY, fromType.getValue());
    assertEquals(Entity.GLOSSARY_TERM, toType.getValue());

    EntityReference reusedRef =
        new EntityReference()
            .withId(existing.getId())
            .withName("Churn")
            .withType(Entity.GLOSSARY_TERM);
    stubFindTo(termRepo, Relationship.RELATED_TO, Entity.GLOSSARY_TERM, List.of(reusedRef));
    reconciler().onMemoryDeleted(memory, true, AIDeletionPolicy.CASCADE);

    verify(termRepo)
        .findTo(fromId.getValue(), fromType.getValue(), Relationship.RELATED_TO, toType.getValue());
    verify(termRepo)
        .deleteRelationship(
            memory.getId(),
            Entity.CONTEXT_MEMORY,
            existing.getId(),
            Entity.GLOSSARY_TERM,
            Relationship.RELATED_TO);
  }

  @Test
  void unknownActionTreatedAsNoOp() {
    MemoryVerdict garbage =
        new MemoryVerdict("WAT", null, null, null, null, null, null, null, null, null);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(memory, new MemoryDerivation(garbage, skip()), AIDeletionPolicy.CASCADE);

    assertEquals(0, result.created());
    assertEquals(0, result.reused());
    verify(termRepo, never()).createInternal(any());
  }

  @Test
  void onMemoryRestoredRestoresOwnedAutomationEntities() {
    EntityReference ownedTermRef = ref("OwnedTerm", Entity.GLOSSARY_TERM);
    EntityReference ownedMetricRef = ref("OwnedMetric", Entity.METRIC);
    stubFindFromAll(
        termRepo, Relationship.DERIVED_FROM, Entity.GLOSSARY_TERM, List.of(ownedTermRef));
    stubFindFromAll(metricRepo, Relationship.DERIVED_FROM, Entity.METRIC, List.of(ownedMetricRef));
    GlossaryTerm ownedTerm =
        new GlossaryTerm().withId(ownedTermRef.getId()).withProvider(ProviderType.AUTOMATION);
    Metric ownedMetric =
        new Metric().withId(ownedMetricRef.getId()).withProvider(ProviderType.AUTOMATION);
    when(termRepo.find(ownedTermRef.getId(), Include.ALL)).thenReturn(ownedTerm);
    when(metricRepo.find(ownedMetricRef.getId(), Include.ALL)).thenReturn(ownedMetric);

    reconciler().onMemoryRestored(memory);

    verify(termRepo).restoreEntity(BOT, ownedTermRef.getId());
    verify(metricRepo).restoreEntity(BOT, ownedMetricRef.getId());
  }

  @Test
  void onMemoryRestoredDoesNotRestoreHumanAdoptedEntities() {
    EntityReference adoptedRef = ref("AdoptedTerm", Entity.GLOSSARY_TERM);
    stubFindFromAll(termRepo, Relationship.DERIVED_FROM, Entity.GLOSSARY_TERM, List.of(adoptedRef));
    stubFindFromAll(metricRepo, Relationship.DERIVED_FROM, Entity.METRIC, List.of());
    GlossaryTerm adopted =
        new GlossaryTerm().withId(adoptedRef.getId()).withProvider(ProviderType.USER);
    when(termRepo.find(adoptedRef.getId(), Include.ALL)).thenReturn(adopted);

    reconciler().onMemoryRestored(memory);

    verify(termRepo, never()).restoreEntity(any(), any());
    verify(metricRepo, never()).restoreEntity(any(), any());
  }

  @Test
  void onMemoryRestoredDoesNotRestoreOrphanReleasedEntities() {
    // ORPHAN/DEPRECATE policy drops the DERIVED_FROM edge during delete; findFrom returns nothing.
    stubFindFromAll(termRepo, Relationship.DERIVED_FROM, Entity.GLOSSARY_TERM, List.of());
    stubFindFromAll(metricRepo, Relationship.DERIVED_FROM, Entity.METRIC, List.of());

    reconciler().onMemoryRestored(memory);

    verify(termRepo, never()).restoreEntity(any(), any());
    verify(metricRepo, never()).restoreEntity(any(), any());
    verify(termRepo, never()).find(any(UUID.class), any(Include.class));
    verify(metricRepo, never()).find(any(UUID.class), any(Include.class));
  }

  @Test
  void createTermWithInvalidNameIsSkippedNoExceptionNoCreate() {
    MemoryVerdict dotName =
        new MemoryVerdict(
            MemoryAction.CREATE,
            "Business",
            null,
            null,
            "bad.name",
            "Bad Name",
            "desc",
            null,
            null,
            null);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(memory, new MemoryDerivation(dotName, skip()), AIDeletionPolicy.CASCADE);

    assertEquals(0, result.created());
    assertEquals(0, result.retired());
    verify(termRepo, never()).createInternal(any());
  }

  @Test
  void createTermWithNullNameIsSkippedNoExceptionNoCreate() {
    MemoryVerdict nullName =
        new MemoryVerdict(
            MemoryAction.CREATE, "Business", null, null, null, null, "desc", null, null, null);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(memory, new MemoryDerivation(nullName, skip()), AIDeletionPolicy.CASCADE);

    assertEquals(0, result.created());
    assertEquals(0, result.retired());
    verify(termRepo, never()).createInternal(any());
  }

  @Test
  void createMetricWithInvalidNameIsSkippedNoExceptionNoCreate() {
    MemoryVerdict slashName =
        new MemoryVerdict(
            MemoryAction.CREATE,
            null,
            null,
            null,
            "bad/metric",
            "Bad Metric",
            "desc",
            "COUNT",
            null,
            null);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(memory, new MemoryDerivation(skip(), slashName), AIDeletionPolicy.CASCADE);

    assertEquals(0, result.created());
    assertEquals(0, result.retired());
    verify(metricRepo, never()).createInternal(any());
  }

  @Test
  void createMetricWithNullNameIsSkippedNoExceptionNoCreate() {
    MemoryVerdict nullName =
        new MemoryVerdict(
            MemoryAction.CREATE, null, null, null, null, null, "desc", "COUNT", null, null);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(memory, new MemoryDerivation(skip(), nullName), AIDeletionPolicy.CASCADE);

    assertEquals(0, result.created());
    assertEquals(0, result.retired());
    verify(metricRepo, never()).createInternal(any());
  }

  @Test
  void createMetricWithUnknownMetricTypeStillCreatesMetricWithNullType() {
    echoMetricOnCreate();
    MemoryVerdict metric =
        new MemoryVerdict(
            MemoryAction.CREATE,
            null,
            null,
            null,
            "churn_rate",
            "Churn Rate",
            "Rate of churn",
            "gauge",
            null,
            null);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(memory, new MemoryDerivation(skip(), metric), AIDeletionPolicy.CASCADE);

    assertEquals(1, result.createdMetrics());
    ArgumentCaptor<Metric> captor = ArgumentCaptor.forClass(Metric.class);
    verify(metricRepo).createInternal(captor.capture());
    assertNull(captor.getValue().getMetricType());
  }

  @Test
  void createMetricWithUnknownUnitKeepsValidTypeAndLeavesUnitUnset() {
    echoMetricOnCreate();
    MemoryVerdict metric =
        new MemoryVerdict(
            MemoryAction.CREATE,
            null,
            null,
            null,
            "churn_rate",
            "Churn Rate",
            "Rate of churn",
            "COUNT",
            "bananas",
            null);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(memory, new MemoryDerivation(skip(), metric), AIDeletionPolicy.CASCADE);

    assertEquals(1, result.createdMetrics());
    ArgumentCaptor<Metric> captor = ArgumentCaptor.forClass(Metric.class);
    verify(metricRepo).createInternal(captor.capture());
    assertEquals(MetricType.COUNT, captor.getValue().getMetricType());
    assertNull(captor.getValue().getUnitOfMeasurement());
  }

  @Test
  void createMetricResolvesEnumsCaseInsensitively() {
    echoMetricOnCreate();
    MemoryVerdict metric =
        new MemoryVerdict(
            MemoryAction.CREATE,
            null,
            null,
            null,
            "churn_rate",
            "Churn Rate",
            "Rate of churn",
            "count",
            "percentage",
            null);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(memory, new MemoryDerivation(skip(), metric), AIDeletionPolicy.CASCADE);

    assertEquals(1, result.createdMetrics());
    ArgumentCaptor<Metric> captor = ArgumentCaptor.forClass(Metric.class);
    verify(metricRepo).createInternal(captor.capture());
    assertEquals(MetricType.COUNT, captor.getValue().getMetricType());
    assertEquals(MetricUnitOfMeasurement.PERCENTAGE, captor.getValue().getUnitOfMeasurement());
  }

  @Test
  void createTermFqnAlreadyExistsReuseInsteadOfCreate() {
    GlossaryTerm alreadyExists =
        new GlossaryTerm()
            .withId(UUID.randomUUID())
            .withName("Churn")
            .withProvider(ProviderType.USER);
    // targetFqn=Business → resolveGlossaryFqn returns "Business", term FQN = "Business.Churn"
    when(termRepo.findByNameOrNull("Business.Churn", Include.NON_DELETED))
        .thenReturn(alreadyExists);
    MemoryVerdict term =
        new MemoryVerdict(
            MemoryAction.CREATE,
            "Business",
            null,
            null,
            "Churn",
            "Churn",
            "Customer churn",
            null,
            null,
            null);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(memory, new MemoryDerivation(term, skip()), AIDeletionPolicy.CASCADE);

    assertEquals(0, result.created(), "createInternal must NOT be called for an existing FQN");
    assertEquals(1, result.reused(), "collision must count as reused");
    verify(termRepo, never()).createInternal(any());
    verify(termRepo)
        .addRelationship(
            eq(memory.getId()),
            eq(alreadyExists.getId()),
            eq(Entity.CONTEXT_MEMORY),
            eq(Entity.GLOSSARY_TERM),
            eq(Relationship.RELATED_TO),
            eq(false));
  }

  @Test
  void createMetricFqnAlreadyExistsReuseInsteadOfCreate() {
    Metric alreadyExists =
        new Metric()
            .withId(UUID.randomUUID())
            .withName("churn_rate")
            .withProvider(ProviderType.USER);
    // metric FQN == name for standalone metrics
    when(metricRepo.findByNameOrNull("churn_rate", Include.NON_DELETED)).thenReturn(alreadyExists);
    MemoryVerdict metric =
        new MemoryVerdict(
            MemoryAction.CREATE,
            null,
            null,
            null,
            "churn_rate",
            "Churn Rate",
            "desc",
            "COUNT",
            null,
            null);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(memory, new MemoryDerivation(skip(), metric), AIDeletionPolicy.CASCADE);

    assertEquals(0, result.created(), "createInternal must NOT be called for an existing FQN");
    assertEquals(1, result.reused(), "collision must count as reused");
    verify(metricRepo, never()).createInternal(any());
    verify(metricRepo)
        .addRelationship(
            eq(memory.getId()),
            eq(alreadyExists.getId()),
            eq(Entity.CONTEXT_MEMORY),
            eq(Entity.METRIC),
            eq(Relationship.RELATED_TO),
            eq(false));
  }

  @Test
  void resolveOrMintGlossaryReuseExistingByNameInsteadOfMinting() {
    Glossary existingGlossary = new Glossary().withId(UUID.randomUUID()).withName("Finance");
    // targetFqn is null → resolveGlossary(null) returns null → falls into resolveOrMintByName
    // resolveOrMintByName checks newGlossaryName="Finance" → finds it
    when(glossaryRepo.findByNameOrNull("Finance", Include.NON_DELETED))
        .thenReturn(existingGlossary);
    echoTermOnCreate();
    MemoryVerdict term =
        new MemoryVerdict(
            MemoryAction.CREATE,
            null,
            "Finance",
            "Finance concepts",
            "ARR",
            "ARR",
            "Annual recurring revenue",
            null,
            null,
            null);

    MemoryReconciler.ReconcileResult result =
        reconciler()
            .reconcile(memory, new MemoryDerivation(term, skip()), AIDeletionPolicy.CASCADE);

    assertEquals(1, result.created(), "term must still be created");
    verify(glossaryRepo, never()).createInternal(any());
    ArgumentCaptor<GlossaryTerm> termCaptor = ArgumentCaptor.forClass(GlossaryTerm.class);
    verify(termRepo).createInternal(termCaptor.capture());
    assertEquals(existingGlossary.getId(), termCaptor.getValue().getGlossary().getId());
  }
}
