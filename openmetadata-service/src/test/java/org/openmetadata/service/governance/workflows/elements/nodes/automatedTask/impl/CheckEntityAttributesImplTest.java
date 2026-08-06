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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.feeds.MessageParser;

/**
 * Covers the reviewers gate of the Glossary Approval Workflow.
 *
 * <p>{@code CheckGlossaryTermHasReviewers} decides whether an approval task is created at all. It
 * evaluates the shipped JsonLogic rule below against the term, and routes a {@code false} result to a
 * terminal status. A term whose reviewers are <b>inherited</b> from its parent glossary must still
 * answer {@code true}; otherwise no approval task is ever created and the term settles in Draft.
 *
 * <p>These tests pin that behaviour at the unit level, where the failing condition can be forced
 * directly: an entity read that returns <b>no</b> reviewers on the term while the parent supplies
 * them. {@link #reviewersRule_inheritedReviewersOnly_evaluatesTrue()} fails without the
 * effective-reviewer resolution in {@code CheckEntityAttributesImpl} and passes with it.
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

  @SuppressWarnings("rawtypes")
  @Mock
  private EntityRepository mockRepository;

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
    when(mockRepository.isSupportsReviewers()).thenReturn(true);

    mockedEntity = mockStatic(Entity.class);
    mockedEntity.when(() -> Entity.getEntityRepository(anyString())).thenReturn(mockRepository);

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

  /**
   * The reported bug. The term carries no reviewers of its own — the read returned none — but its
   * glossary supplies one, so effective-reviewer resolution must make the gate answer true. Without
   * that resolution the rule sees an empty array, {@code some} is vacuously false, and the term is
   * routed to Draft with no approval task.
   */
  @Test
  void reviewersRule_inheritedReviewersOnly_evaluatesTrue() {
    givenRelatedEntity(termWithReviewers(null));
    givenEffectiveReviewers(reviewer("manoj"));

    delegate.execute(execution);

    assertTrue(
        result(),
        "Gate must see the inherited reviewer and allow the approval task to be created; "
            + "a false result here is what leaves the term in Draft");
  }

  /** A reviewer set directly on the term is unaffected by the resolution. */
  @Test
  void reviewersRule_directReviewersOnTerm_evaluatesTrue() {
    givenRelatedEntity(termWithReviewers(List.of(reviewer("manoj"))));

    delegate.execute(execution);

    assertTrue(result(), "A directly attached reviewer must satisfy the gate");
  }

  /** Nothing to inherit anywhere: the gate must still answer false and auto-approve. */
  @Test
  void reviewersRule_noReviewersAnywhere_evaluatesFalse() {
    givenRelatedEntity(termWithReviewers(null));
    givenEffectiveReviewers();

    delegate.execute(execution);

    assertFalse(result(), "With no reviewers on the term or its parents the gate must be false");
  }

  /**
   * A reviewer reference without a fullyQualifiedName does not satisfy the shipped rule, which tests
   * {@code fullyQualifiedName != null} per element. Resolution must not paper over that.
   */
  @Test
  void reviewersRule_inheritedReviewerWithoutFqn_evaluatesFalse() {
    givenRelatedEntity(termWithReviewers(null));
    givenEffectiveReviewers(new EntityReference().withType(Entity.USER));

    delegate.execute(execution);

    assertFalse(result(), "A reviewer reference with no FQN must not satisfy the rule");
  }

  /**
   * Resolution must not be attempted for entities that do not support reviewers, and the gate must
   * fall back to whatever the entity itself carries.
   */
  @Test
  void reviewersRule_entityWithoutReviewerSupport_evaluatesFalse() {
    when(mockRepository.isSupportsReviewers()).thenReturn(false);
    givenRelatedEntity(termWithReviewers(null));

    delegate.execute(execution);

    assertFalse(result(), "An entity type without reviewer support must not satisfy the gate");
    assertEquals(1, capturedVars.size(), "Only the node result should be written");
  }

  private void givenRelatedEntity(GlossaryTerm term) {
    mockedEntity
        .when(
            () ->
                Entity.getEntity(
                    any(MessageParser.EntityLink.class), anyString(), any(Include.class)))
        .thenReturn(term);
  }

  @SuppressWarnings("unchecked")
  private void givenEffectiveReviewers(EntityReference... reviewers) {
    when(mockRepository.getEffectiveReviewersUntyped(any())).thenReturn(List.of(reviewers));
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

  private static void injectField(Object target, String fieldName, Object value) throws Exception {
    Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(target, value);
  }
}
