/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.MetadataCollectionConfiguration;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.metadata.MetadataCollectionService;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;

/**
 * Regression tests for {@link CollectMetadataImpl}. The contract these protect: a {@code
 * collectMetadataTask} node whose {@code inputNamespaceMap} is omitted — which the JSON schema
 * explicitly permits and the server accepts and deploys — resolves {@code relatedEntity} from the
 * {@code global} namespace (the schema-declared default) instead of looking it up under a {@code
 * null} namespace and NPE-ing in {@link EntityLink#parse}.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CollectMetadataImplTest {

  private static final String ACTIVITY_ID = "collect";
  private static final String PROCESS_DEFINITION_ID = "DomainLifecycle:1:1";
  private static final String WORKFLOW_NAME = "DomainLifecycle";
  private static final String NODE_NAME = "CollectDraft";
  private static final String GLOBAL_RELATED_ENTITY =
      Workflow.GLOBAL_NAMESPACE + "_" + Workflow.RELATED_ENTITY_VARIABLE;
  private static final String ENTITY_LINK = "<#E::domain::finance>";
  private static final String CONFIG_JSON = "{\"stage\":\"Draft\",\"taskAssignees\":\"owners\"}";

  @Mock private DelegateExecution execution;
  @Mock private Expression configurationExpr;
  @Mock private Expression inputNamespaceMapExpr;
  @Mock private Expression workflowNameExpr;
  @Mock private Expression nodeNameExpr;

  private CollectMetadataImpl delegate;
  private MockedStatic<Entity> mockedEntity;
  private MockedConstruction<MetadataCollectionService> mockedServiceConstruction;
  private Map<String, Object> capturedVars;
  private Domain domain;
  private EntityReference actor;

  @BeforeEach
  void setUp() throws Exception {
    delegate = new CollectMetadataImpl();
    injectField(delegate, "configurationExpr", configurationExpr);
    injectField(delegate, "inputNamespaceMapExpr", inputNamespaceMapExpr);
    injectField(delegate, "workflowNameExpr", workflowNameExpr);
    injectField(delegate, "nodeNameExpr", nodeNameExpr);

    when(execution.getProcessDefinitionId()).thenReturn(PROCESS_DEFINITION_ID);
    when(execution.getCurrentActivityId()).thenReturn(ACTIVITY_ID);
    when(configurationExpr.getValue(execution)).thenReturn(CONFIG_JSON);
    when(workflowNameExpr.getValue(execution)).thenReturn(WORKFLOW_NAME);
    when(nodeNameExpr.getValue(execution)).thenReturn(NODE_NAME);

    domain =
        new Domain()
            .withId(UUID.randomUUID())
            .withName("finance")
            .withFullyQualifiedName("finance");
    actor = new EntityReference().withName("governance-bot").withType(Entity.USER);

    mockedEntity = mockStatic(Entity.class);
    mockedEntity
        .when(() -> Entity.getEntity(any(EntityLink.class), eq("*"), eq(Include.NON_DELETED)))
        .thenReturn(domain);
    mockedEntity
        .when(() -> Entity.getEntityRepository(Entity.TASK))
        .thenReturn(mock(TaskRepository.class));
    mockedEntity
        .when(
            () ->
                Entity.getEntityReferenceByName(Entity.USER, "governance-bot", Include.NON_DELETED))
        .thenReturn(actor);

    mockedServiceConstruction = mockConstruction(MetadataCollectionService.class);

    capturedVars = new HashMap<>();
    doAnswer(
            inv -> {
              capturedVars.put(inv.getArgument(0), inv.getArgument(1));
              return null;
            })
        .when(execution)
        .setVariable(anyString(), any());
  }

  @AfterEach
  void tearDown() {
    if (mockedEntity != null) {
      mockedEntity.close();
    }
    if (mockedServiceConstruction != null) {
      mockedServiceConstruction.close();
    }
  }

  /**
   * The bug: an omitted inputNamespaceMap is materialized as "{}" in the BPMN, so a bare {@code
   * namespaceFor("relatedEntity")} returns null, {@code getNamespacedVariable(null, ...)} returns
   * null and {@code EntityLink.parse(null)} NPEs, which the delegate rethrows as {@code
   * BpmnError(WORKFLOW_RUNTIME_EXCEPTION)}. The fix falls back to the global namespace the
   * event-based and periodic-batch triggers always supply.
   */
  @Test
  void omittedInputNamespaceMap_fallsBackToGlobalNamespaceAndReconciles() {
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn("{}");
    when(execution.getVariable(GLOBAL_RELATED_ENTITY)).thenReturn(ENTITY_LINK);

    assertDoesNotThrow(() -> delegate.execute(execution));

    verify(execution).getVariable(GLOBAL_RELATED_ENTITY);
    MetadataCollectionService service = mockedServiceConstruction.constructed().get(0);
    verify(service)
        .reconcile(
            eq(domain),
            any(MetadataCollectionConfiguration.class),
            eq(WORKFLOW_NAME),
            eq(NODE_NAME));
  }

  /**
   * No regression: when the map names a namespace, the delegate reads {@code relatedEntity} from
   * that namespace (not global), exactly as before the fix.
   */
  @Test
  void explicitInputNamespaceMap_readsRelatedEntityFromNamedNamespace() {
    final String namedNamespace = "previous";
    when(inputNamespaceMapExpr.getValue(execution))
        .thenReturn("{\"relatedEntity\":\"" + namedNamespace + "\"}");
    when(execution.getVariable(namedNamespace + "_" + Workflow.RELATED_ENTITY_VARIABLE))
        .thenReturn(ENTITY_LINK);

    assertDoesNotThrow(() -> delegate.execute(execution));

    verify(execution).getVariable(namedNamespace + "_" + Workflow.RELATED_ENTITY_VARIABLE);
    verify(execution, never()).getVariable(GLOBAL_RELATED_ENTITY);
    MetadataCollectionService service = mockedServiceConstruction.constructed().get(0);
    verify(service)
        .reconcile(
            eq(domain),
            any(MetadataCollectionConfiguration.class),
            eq(WORKFLOW_NAME),
            eq(NODE_NAME));
  }

  /**
   * Defense-in-depth: when the global variable is genuinely missing (e.g. a noOp-triggered workflow
   * that never set it), the delegate still surfaces a {@code BpmnError(WORKFLOW_RUNTIME_EXCEPTION)}
   * rather than silently no-op'ing — the failure is observable, just no longer a bare NPE from a
   * misconfigured namespace map.
   */
  @Test
  void omittedMapAndMissingGlobalVariable_surfacesBpmnError() {
    when(inputNamespaceMapExpr.getValue(execution)).thenReturn("{}");
    when(execution.getVariable(GLOBAL_RELATED_ENTITY)).thenReturn(null);

    BpmnError error = assertThrows(BpmnError.class, () -> delegate.execute(execution));

    assertEquals(Workflow.WORKFLOW_RUNTIME_EXCEPTION, error.getErrorCode());
  }

  private static void injectField(Object target, String fieldName, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}
