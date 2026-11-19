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
package org.openmetadata.service.aicontext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.function.Predicate;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.aicontext.KnowledgeItem;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

class AIContextFinderAccessTest {
  private MockedStatic<Entity> entity;

  @BeforeEach
  void stubRepositories() {
    entity = mockStatic(Entity.class);
    entity
        .when(() -> Entity.getEntityRepository(any(String.class)))
        .thenReturn(mock(EntityRepository.class));
  }

  @AfterEach
  void closeStub() {
    entity.close();
  }

  @Test
  void knowledgeViewer_rejectsItemsTheAuthorizerDeniesAndChecksEachItemOnce() {
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);
    doThrow(new AuthorizationException("denied"))
        .when(authorizer)
        .authorize(
            any(SecurityContext.class), any(OperationContext.class), any(ResourceContext.class));

    Predicate<KnowledgeItem> canView =
        AIContextFinderAccess.knowledgeViewer(authorizer, securityContext);

    assertFalse(canView.test(item(KnowledgeItem.Type.PAGE, "Finance.Playbook")));
    assertFalse(canView.test(item(KnowledgeItem.Type.PAGE, "Finance.Playbook")));
    assertFalse(canView.test(item(KnowledgeItem.Type.METRIC, "Finance.Playbook")));
    ArgumentCaptor<OperationContext> operations = ArgumentCaptor.forClass(OperationContext.class);
    verify(authorizer, times(2))
        .authorize(any(SecurityContext.class), operations.capture(), any(ResourceContext.class));
    for (OperationContext operation : operations.getAllValues()) {
      assertEquals(
          List.of(MetadataOperation.VIEW_BASIC),
          operation.getOperations((ResourceContextInterface) null));
    }
  }

  @Test
  void knowledgeViewer_acceptsItemsTheAuthorizerAllows() {
    Predicate<KnowledgeItem> canView =
        AIContextFinderAccess.knowledgeViewer(mock(Authorizer.class), mock(SecurityContext.class));

    assertTrue(canView.test(item(KnowledgeItem.Type.GLOSSARY_TERM, "Business.Order")));
  }

  private static KnowledgeItem item(KnowledgeItem.Type type, String fqn) {
    return new KnowledgeItem().withType(type).withName(fqn).withFullyQualifiedName(fqn);
  }
}
