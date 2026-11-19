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

package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseServiceRepository;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.jdbi3.WorkflowRepository;

/** A soft-deleted service or workflow can be restored, so {@code migrate} re-encrypts it too. */
@SuppressWarnings({"unchecked", "rawtypes"})
class SecretsManagerUpdateServiceTest {
  private static final String CLUSTER = "openmetadata";

  private final DatabaseService service =
      new DatabaseService()
          .withId(UUID.randomUUID())
          .withName("deleted-service")
          .withDeleted(true)
          .withServiceType(DatabaseServiceType.Mysql)
          .withConnection(new DatabaseConnection().withConfig(Map.of("type", "Mysql")));
  private final Workflow workflow =
      new Workflow().withId(UUID.randomUUID()).withName("deleted-workflow").withDeleted(true);

  private final DatabaseServiceRepository serviceRepository = mock(DatabaseServiceRepository.class);
  private final EntityDAO<DatabaseService> serviceDao = mock(EntityDAO.class);
  private final WorkflowRepository workflowRepository = mock(WorkflowRepository.class);
  private final EntityDAO<Workflow> workflowDao = mock(EntityDAO.class);
  private final SecretsManager secretsManager = mock(SecretsManager.class);

  @Test
  void reEncryptsSoftDeletedServicesAndWorkflows() {
    stubRepositories();
    Map<String, EntityRepository> repositories =
        Map.of(
            Entity.DATABASE_SERVICE,
            serviceRepository,
            Entity.WORKFLOW,
            workflowRepository,
            Entity.USER,
            emptyRepository(UserRepository.class),
            Entity.INGESTION_PIPELINE,
            emptyRepository(IngestionPipelineRepository.class));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class);
        MockedStatic<SecretsManagerFactory> factory = mockStatic(SecretsManagerFactory.class)) {
      entity.when(Entity::getEntityList).thenReturn(Set.of(Entity.DATABASE_SERVICE));
      entity
          .when(() -> Entity.getEntityRepository(anyString()))
          .thenAnswer(call -> repositories.get(call.<String>getArgument(0)));
      factory
          .when(() -> SecretsManagerFactory.createSecretsManager(null, CLUSTER))
          .thenReturn(secretsManager);

      new SecretsManagerUpdateService(secretsManager, CLUSTER).updateEntities();
    }

    assertListedWithDeleted(serviceRepository, serviceDao);
    verify(serviceDao).findEntityById(service.getId(), Include.ALL);
    verify(serviceDao).update(service);
    assertListedWithDeleted(workflowRepository, workflowDao);
    verify(workflowDao).findEntityById(workflow.getId(), Include.ALL);
    verify(workflowDao).update(workflow);
  }

  private void stubRepositories() {
    when(serviceRepository.getServiceConnectionClass()).thenReturn(DatabaseConnection.class);
    when(serviceRepository.getServiceType()).thenReturn(ServiceType.DATABASE);
    when(serviceRepository.getDao()).thenReturn(serviceDao);
    when(serviceRepository.listAfter(any(), any(), any(), anyInt(), any()))
        .thenReturn(new ResultList<>(List.of(service)));
    when(serviceDao.findEntityById(service.getId(), Include.ALL)).thenReturn(service);

    when(workflowRepository.getDao()).thenReturn(workflowDao);
    when(workflowRepository.listAfter(any(), any(), any(), anyInt(), any()))
        .thenReturn(new ResultList<>(List.of(workflow)));
    when(workflowDao.findEntityById(workflow.getId(), Include.ALL)).thenReturn(workflow);

    when(secretsManager.getSecretsManagerProvider()).thenReturn(SecretsManagerProvider.DB);
    when(secretsManager.decryptServiceConnectionConfig(any(), anyString(), any()))
        .thenAnswer(call -> call.getArgument(0));
    when(secretsManager.encryptServiceConnectionConfig(any(), anyString(), anyString(), any()))
        .thenAnswer(call -> call.getArgument(0));
    when(secretsManager.decryptWorkflow(any())).thenAnswer(call -> call.getArgument(0));
    when(secretsManager.encryptWorkflow(any())).thenAnswer(call -> call.getArgument(0));
  }

  private static <R extends EntityRepository> R emptyRepository(Class<R> type) {
    R repository = mock(type);
    when(repository.getDao()).thenReturn(mock(EntityDAO.class));
    when(repository.listAfter(any(), any(), any(), anyInt(), any()))
        .thenReturn(new ResultList<>(List.of()));
    return repository;
  }

  private static void assertListedWithDeleted(EntityRepository repository, EntityDAO dao) {
    ArgumentCaptor<ListFilter> listed = ArgumentCaptor.forClass(ListFilter.class);
    verify(repository).listAfter(any(), any(), listed.capture(), anyInt(), any());
    assertEquals(Include.ALL, listed.getValue().getInclude());
    ArgumentCaptor<ListFilter> counted = ArgumentCaptor.forClass(ListFilter.class);
    verify(dao).listCount(counted.capture());
    assertEquals(Include.ALL, counted.getValue().getInclude());
  }
}
