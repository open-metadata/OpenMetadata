/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.services.automations;

import static org.openmetadata.service.Entity.FIELD_OWNERS;

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.ServiceConnectionEntityInterface;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.automations.WorkflowType;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.WorkflowRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.automations.WorkflowMapper;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.converter.ClassConverterFactory;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

/**
 * Service layer for Workflow entity operations.
 *
 * <p>Extends EntityBaseService to inherit all standard CRUD operations with proper authorization
 * and repository delegation.
 */
@Slf4j
@Singleton
@Service(entityType = Entity.WORKFLOW)
public class WorkflowService extends EntityBaseService<Workflow, WorkflowRepository> {

  @Getter private final WorkflowMapper mapper;
  public static final String FIELDS = "owners";
  private PipelineServiceClientInterface pipelineServiceClient;
  private OpenMetadataApplicationConfig openMetadataApplicationConfig;

  @Inject
  public WorkflowService(
      WorkflowRepository repository, Authorizer authorizer, WorkflowMapper mapper, Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.WORKFLOW, Workflow.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {
    this.openMetadataApplicationConfig = config;
    this.pipelineServiceClient =
        PipelineServiceClientFactory.createPipelineServiceClient(
            config.getPipelineServiceClientConfiguration());
  }

  public PipelineServiceClientResponse runAutomationsWorkflow(UriInfo uriInfo, UUID id) {
    EntityUtil.Fields fields = getFields(FIELD_OWNERS);
    Workflow workflow = repository.get(uriInfo, id, fields);
    workflow.setOpenMetadataServerConnection(
        new OpenMetadataConnectionBuilder(openMetadataApplicationConfig).build());
    return pipelineServiceClient.runAutomationsWorkflow(workflow);
  }

  public Workflow unmask(Workflow workflow) {
    repository.setFullyQualifiedName(workflow);
    Workflow originalWorkflow;
    if (WorkflowType.TEST_CONNECTION.equals(workflow.getWorkflowType())) {
      originalWorkflow = buildFromOriginalServiceConnection(workflow);
    } else {
      originalWorkflow =
          repository.findByNameOrNull(workflow.getFullyQualifiedName(), Include.NON_DELETED);
    }
    return EntityMaskerFactory.getEntityMasker().unmaskWorkflow(workflow, originalWorkflow);
  }

  public Workflow decryptOrNullify(SecurityContext securityContext, Workflow workflow) {
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    try {
      authorizer.authorize(
          securityContext,
          new OperationContext(entityType, MetadataOperation.VIEW_ALL),
          getResourceContextById(workflow.getId()));
    } catch (AuthorizationException e) {
      Workflow workflowConverted =
          (Workflow) ClassConverterFactory.getConverter(Workflow.class).convert(workflow);
      if (workflowConverted.getRequest() instanceof TestServiceConnectionRequest) {
        ((ServiceConnectionEntityInterface)
                ((TestServiceConnectionRequest) workflowConverted.getRequest()).getConnection())
            .setConfig(null);
      }
      return workflowConverted;
    }
    Workflow workflowDecrypted = secretsManager.decryptWorkflow(workflow);
    OpenMetadataConnection openMetadataServerConnection =
        new OpenMetadataConnectionBuilder(openMetadataApplicationConfig).build();
    workflowDecrypted.setOpenMetadataServerConnection(
        secretsManager.encryptOpenMetadataConnection(openMetadataServerConnection, false));
    if (authorizer.shouldMaskPasswords(securityContext)) {
      workflowDecrypted = EntityMaskerFactory.getEntityMasker().maskWorkflow(workflowDecrypted);
    }
    return workflowDecrypted;
  }

  private Workflow buildFromOriginalServiceConnection(Workflow workflow) {
    Workflow originalWorkflow =
        repository.findByNameOrNull(workflow.getFullyQualifiedName(), Include.NON_DELETED);
    if (originalWorkflow == null) {
      originalWorkflow =
          (Workflow) ClassConverterFactory.getConverter(Workflow.class).convert(workflow);
    }
    if (originalWorkflow.getRequest()
        instanceof TestServiceConnectionRequest testServiceConnection) {
      EntityRepository<? extends EntityInterface> serviceRepository =
          Entity.getServiceEntityRepository(testServiceConnection.getServiceType());
      ServiceEntityInterface originalService =
          (ServiceEntityInterface)
              serviceRepository.findByNameOrNull(
                  testServiceConnection.getServiceName(), Include.NON_DELETED);
      if (originalService != null && originalService.getConnection() != null) {
        testServiceConnection.setConnection(originalService.getConnection());
        originalWorkflow.setRequest(testServiceConnection);
      }
    }
    return originalWorkflow;
  }

  public static class WorkflowList extends ResultList<Workflow> {
    /* Required for serde */
  }
}
