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

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs;
import org.openmetadata.service.resources.feeds.MessageParser;

/**
 * Covers the reviewers gate of the Glossary Approval Workflow.
 *
 * <p>{@code CheckGlossaryTermHasReviewers} decides whether an approval task is created at all: it
 * evaluates the shipped JsonLogic rule below against the term and routes a {@code false} result to a
 * terminal status, leaving the term in Draft with no task. These tests pin how that rule reads the
 * entity it is handed.
 *
 * <p>Whether a term that <i>inherits</i> its reviewers arrives here with them populated is a property
 * of the read path, not of this delegate — it is covered by the inheritance tests and by {@code
 * GlossaryTermInheritedReviewerApprovalIT}.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CheckEntityAttributesImplTest {

  /** The rule shipped in GlossaryApprovalWorkflow.json for CheckGlossaryTermHasReviewers. */
  private static final String HAS_REVIEWERS_RULE =
      "{\"and\":[{\"some\":[{\"var\":\"reviewers\"},{\"!=\":[{\"var\":\"fullyQualifiedName\"},null]}]}]}";

  private static final String NODE_ID = "CheckGlossaryTermHasReviewers";
  private static final String RESULT_KEY = NODE_ID + "_result";

  @Mock private DelegateExecution execution;
  @Mock private Expression rulesExpr;
  @Mock private Expression inputNamespaceMapExpr;

  private CheckEntityAttributesImpl delegate;
  private MockedStatic<Entity> mockedEntity;
  private Map<String, Object> capturedVars;

  @BeforeEach
  void setUp() throws Exception {
    delegate = new CheckEntityAttributesImpl();
    injectField(delegate, "rulesExpr", rulesExpr);
    injectField(delegate, "inputNamespaceMapExpr", inputNamespaceMapExpr);

    when(inputNamespaceMapExpr.getValue(execution)).thenReturn("{\"relatedEntity\":\"global\"}");
    when(rulesExpr.getValue(execution)).thenReturn(HAS_REVIEWERS_RULE);
    when(execution.getProcessDefinitionId()).thenReturn("GlossaryTermApprovalWorkflow:1:1");
    when(execution.getCurrentActivityId()).thenReturn(NODE_ID);
    when(execution.getVariable("global_relatedEntity"))
        .thenReturn("<#E::glossaryTerm::Property.hello world>");

    mockedEntity = mockStatic(Entity.class);

    capturedVars = new HashMap<>();
    doAnswer(
            invocation -> {
              capturedVars.put(invocation.getArgument(0), invocation.getArgument(1));
              return null;
            })
        .when(execution)
        .setVariable(anyString(), any());
  }

  @AfterEach
  void tearDown() {
    mockedEntity.close();
  }

  /** Reviewers present on the entity — whether set directly or applied by inheritance. */
  @Test
  void reviewersRule_reviewersPresentOnEntity_evaluatesTrue() {
    givenRelatedEntity(termWithReviewers(List.of(reviewer("manoj"))));

    delegate.execute(execution);

    assertTrue(result(), "A term carrying a reviewer must satisfy the gate");
  }

  /** No reviewers anywhere: the gate must be false so the term auto-approves. */
  @Test
  void reviewersRule_noReviewers_evaluatesFalse() {
    givenRelatedEntity(termWithReviewers(null));

    delegate.execute(execution);

    assertFalse(result(), "With no reviewers the gate must be false");
  }

  /**
   * The shipped rule tests {@code fullyQualifiedName != null} per element, so a reference missing its
   * FQN does not satisfy it. Pinned because inheritance copies references between entities.
   */
  @Test
  void reviewersRule_reviewerWithoutFqn_evaluatesFalse() {
    givenRelatedEntity(termWithReviewers(List.of(new EntityReference().withType(Entity.USER))));

    delegate.execute(execution);

    assertFalse(result(), "A reviewer reference with no FQN must not satisfy the rule");
  }

  private void givenRelatedEntity(GlossaryTerm term) {
    mockedEntity
        .when(
            () ->
                Entity.getEntity(
                    any(MessageParser.EntityLink.class), anyString(), any(Include.class)))
        .thenReturn(term);
  }

  private GlossaryTerm termWithReviewers(List<EntityReference> reviewers) {
    return new GlossaryTerm()
        .withName("hello world")
        .withFullyQualifiedName("Property.hello world")
        .withDescription("hello world")
        .withReviewers(reviewers);
  }

  private EntityReference reviewer(String name) {
    return new EntityReference()
        .withType(Entity.USER)
        .withName(name)
        .withFullyQualifiedName(name)
        .withInherited(true);
  }

  private boolean result() {
    return Boolean.TRUE.equals(capturedVars.get(RESULT_KEY));
  }

  // --- DataProduct asset/outputPort count enrichment tests (#28433) ---

  private static final String HAS_ASSETS_RULE =
      "{\">\": [{\"var\": \"" + CheckEntityAttributesImpl.ASSETS_COUNT + "\"}, 0]}";
  private static final String HAS_OUTPUT_PORTS_RULE =
      "{\">\": [{\"var\": \"" + CheckEntityAttributesImpl.OUTPUT_PORTS_COUNT + "\"}, 0]}";

  @Test
  void dataProductWithAssets_assetsCountRule_evaluatesTrue() {
    UUID dpId = UUID.randomUUID();
    setupDataProductTest(dpId, 3, 0);

    delegate.execute(execution);

    assertTrue(result(), "A data product with assets must satisfy assetsCount > 0");
  }

  @Test
  void dataProductWithoutAssets_assetsCountRule_evaluatesFalse() {
    UUID dpId = UUID.randomUUID();
    setupDataProductTest(dpId, 0, 0);

    delegate.execute(execution);

    assertFalse(result(), "A data product without assets must not satisfy assetsCount > 0");
  }

  @Test
  void dataProductWithOutputPorts_outputPortsCountRule_evaluatesTrue() {
    UUID dpId = UUID.randomUUID();
    setupDataProductTestForOutputPorts(dpId, 0, 2);

    delegate.execute(execution);

    assertTrue(result(), "A data product with output ports must satisfy outputPortsCount > 0");
  }

  @Test
  void dataProductWithoutOutputPorts_outputPortsCountRule_evaluatesFalse() {
    UUID dpId = UUID.randomUUID();
    setupDataProductTestForOutputPorts(dpId, 0, 0);

    delegate.execute(execution);

    assertFalse(
        result(), "A data product without output ports must not satisfy outputPortsCount > 0");
  }

  private void setupDataProductTest(UUID dpId, int assetsCount, int outputPortsCount) {
    setupDataProductExecution(dpId, HAS_ASSETS_RULE, assetsCount, outputPortsCount);
  }

  private void setupDataProductTestForOutputPorts(
      UUID dpId, int assetsCount, int outputPortsCount) {
    setupDataProductExecution(dpId, HAS_OUTPUT_PORTS_RULE, assetsCount, outputPortsCount);
  }

  private void setupDataProductExecution(
      UUID dpId, String rule, int assetsCount, int outputPortsCount) {
    when(rulesExpr.getValue(execution)).thenReturn(rule);
    when(execution.getVariable("global_relatedEntity"))
        .thenReturn("<#E::dataProduct::TestDomain.TestDP>");

    DataProduct dp =
        new DataProduct()
            .withId(dpId)
            .withName("TestDP")
            .withFullyQualifiedName("TestDomain.TestDP")
            .withDescription("Test data product");

    mockedEntity
        .when(
            () ->
                Entity.getEntity(
                    any(MessageParser.EntityLink.class), anyString(), any(Include.class)))
        .thenReturn(dp);

    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CoreRelationshipDAOs.EntityRelationshipDAO relationshipDAO =
        mock(CoreRelationshipDAOs.EntityRelationshipDAO.class);
    mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(relationshipDAO.countFindTo(
            eq(dpId), eq(Entity.DATA_PRODUCT), eq(List.of(Relationship.HAS.ordinal()))))
        .thenReturn(assetsCount);
    when(relationshipDAO.countFindTo(
            eq(dpId), eq(Entity.DATA_PRODUCT), eq(List.of(Relationship.OUTPUT_PORT.ordinal()))))
        .thenReturn(outputPortsCount);
  }

  private static void injectField(Object target, String fieldName, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}
