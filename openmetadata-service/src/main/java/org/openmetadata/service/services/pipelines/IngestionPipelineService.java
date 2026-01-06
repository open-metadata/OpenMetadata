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

package org.openmetadata.service.services.pipelines;

import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.schema.type.MetadataOperation.CREATE;
import static org.openmetadata.service.Entity.FIELD_OWNERS;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.api.configuration.LogStorageConfiguration;
import org.openmetadata.schema.api.configuration.pipelineServiceClient.PipelineServiceClientConfiguration;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.OpenMetadataApplicationConfigHolder;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.logstorage.LogStorageFactory;
import org.openmetadata.service.logstorage.LogStorageInterface;
import org.openmetadata.service.monitoring.StreamableLogsMetrics;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineMapper;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

@Slf4j
@Singleton
@Service(entityType = Entity.INGESTION_PIPELINE)
public class IngestionPipelineService
    extends EntityBaseService<IngestionPipeline, IngestionPipelineRepository> {
  public static final String COLLECTION_PATH = "v1/services/ingestionPipelines/";
  @Getter private final IngestionPipelineMapper mapper;
  private final PipelineServiceClientInterface pipelineServiceClient;
  public static final String FIELDS = "owners,followers";

  private final StreamableLogsMetrics streamableLogsMetrics;

  @Override
  public IngestionPipeline addHref(UriInfo uriInfo, IngestionPipeline ingestionPipeline) {
    super.addHref(uriInfo, ingestionPipeline);
    Entity.withHref(uriInfo, ingestionPipeline.getService());
    return ingestionPipeline;
  }

  @Override
  public void initialize(OpenMetadataApplicationConfig config) {}

  @Inject
  public IngestionPipelineService(
      IngestionPipelineRepository repository,
      StreamableLogsMetrics streamableLogsMetrics,
      Authorizer authorizer,
      IngestionPipelineMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.INGESTION_PIPELINE, IngestionPipeline.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
    this.streamableLogsMetrics = streamableLogsMetrics;

    PipelineServiceClientConfiguration configuration =
        OpenMetadataApplicationConfigHolder.getInstance().getPipelineServiceClientConfiguration();
    this.pipelineServiceClient =
        PipelineServiceClientFactory.createPipelineServiceClient(configuration);
    repository.setPipelineServiceClient(pipelineServiceClient);

    // Initialize log storage - always initialize with at least DefaultLogStorage
    LogStorageConfiguration logStorageConfig =
        configuration != null ? configuration.getLogStorageConfiguration() : null;

    // Set the configuration in repository so it knows what's enabled
    repository.setLogStorageConfiguration(logStorageConfig);

    try {
      LogStorageInterface logStorage =
          LogStorageFactory.create(logStorageConfig, pipelineServiceClient, streamableLogsMetrics);
      repository.setLogStorage(logStorage);
      LOG.info(
          "Log storage initialized successfully: type={}",
          logStorageConfig != null ? logStorageConfig.getType() : "default");
    } catch (Exception e) {
      LOG.warn("Failed to initialize configured log storage, using default implementation", e);
      try {
        // Fallback to default log storage that delegates to pipeline service client
        LogStorageInterface defaultLogStorage =
            LogStorageFactory.create(null, pipelineServiceClient, streamableLogsMetrics);
        repository.setLogStorage(defaultLogStorage);
        // Set a default configuration so isLogStorageEnabled() returns true
        repository.setLogStorageConfiguration(new LogStorageConfiguration());
      } catch (Exception ex) {
        LOG.error("Failed to initialize default log storage", ex);
      }
    }
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    return listOf(
        MetadataOperation.CREATE_INGESTION_PIPELINE_AUTOMATOR,
        MetadataOperation.EDIT_INGESTION_PIPELINE_STATUS);
  }

  public MetadataOperation getOperationForPipelineType(IngestionPipeline ingestionPipeline) {
    String pipelineType = IngestionPipelineRepository.getPipelineWorkflowType(ingestionPipeline);
    try {
      return MetadataOperation.valueOf(
          String.format("CREATE_INGESTION_PIPELINE_%s", pipelineType.toUpperCase()));
    } catch (IllegalArgumentException | NullPointerException e) {
      return CREATE;
    }
  }

  public PipelineServiceClientInterface getPipelineServiceClient() {
    return pipelineServiceClient;
  }

  public Response createWithCustomOperation(
      UriInfo uriInfo, SecurityContext securityContext, IngestionPipeline entity) {
    OperationContext operationContext =
        new OperationContext(Entity.INGESTION_PIPELINE, getOperationForPipelineType(entity));
    CreateResourceContext<IngestionPipeline> createResourceContext =
        new CreateResourceContext<>(Entity.INGESTION_PIPELINE, entity);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    authorizer.authorize(securityContext, operationContext, createResourceContext);
    entity = addHref(uriInfo, repository.create(uriInfo, entity));
    return Response.created(entity.getHref()).entity(entity).build();
  }

  public void unmask(IngestionPipeline ingestionPipeline) {
    repository.setFullyQualifiedName(ingestionPipeline);
    IngestionPipeline originalIngestionPipeline =
        repository.findByNameOrNull(ingestionPipeline.getFullyQualifiedName(), Include.NON_DELETED);
    EntityMaskerFactory.getEntityMasker()
        .unmaskIngestionPipeline(ingestionPipeline, originalIngestionPipeline);
  }

  public PipelineServiceClientResponse deployPipeline(
      UUID id, UriInfo uriInfo, SecurityContext securityContext) {
    Fields fields = getFields(FIELD_OWNERS);
    IngestionPipeline ingestionPipeline = repository.get(uriInfo, id, fields);
    CreateResourceContext<IngestionPipeline> createResourceContext =
        new CreateResourceContext<>(Entity.INGESTION_PIPELINE, ingestionPipeline);
    OperationContext operationContext =
        new OperationContext(Entity.INGESTION_PIPELINE, MetadataOperation.DEPLOY);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    decryptOrNullify(securityContext, ingestionPipeline, true);
    ServiceEntityInterface serviceEntity =
        Entity.getEntity(ingestionPipeline.getService(), "", Include.NON_DELETED);
    if (repository.isS3LogStorageEnabled()
        && repository.getLogStorageConfiguration().getEnabled()) {
      ingestionPipeline.setEnableStreamableLogs(true);
    }
    PipelineServiceClientResponse status =
        pipelineServiceClient.deployPipeline(ingestionPipeline, serviceEntity);
    if (status.getCode() == 200) {
      createOrUpdate(uriInfo, securityContext, ingestionPipeline);
    }
    return status;
  }

  public PipelineServiceClientResponse triggerPipeline(
      UUID id, UriInfo uriInfo, SecurityContext securityContext, String botName) {
    Fields fields = getFields(FIELD_OWNERS);
    IngestionPipeline ingestionPipeline = repository.get(uriInfo, id, fields);
    CreateResourceContext<IngestionPipeline> createResourceContext =
        new CreateResourceContext<>(Entity.INGESTION_PIPELINE, ingestionPipeline);
    OperationContext operationContext =
        new OperationContext(Entity.INGESTION_PIPELINE, MetadataOperation.TRIGGER);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    if (CommonUtil.nullOrEmpty(botName)) {
      ingestionPipeline.setOpenMetadataServerConnection(
          new OpenMetadataConnectionBuilder(repository.getOpenMetadataApplicationConfig()).build());
    } else {
      ingestionPipeline.setOpenMetadataServerConnection(
          new OpenMetadataConnectionBuilder(repository.getOpenMetadataApplicationConfig(), botName)
              .build());
    }
    decryptOrNullify(securityContext, ingestionPipeline, true);
    ServiceEntityInterface serviceEntity =
        Entity.getEntity(ingestionPipeline.getService(), "", Include.NON_DELETED);
    return pipelineServiceClient.runPipeline(ingestionPipeline, serviceEntity);
  }

  public Response toggleIngestion(UUID id, UriInfo uriInfo, SecurityContext securityContext) {
    Fields fields = getFields(FIELD_OWNERS);
    IngestionPipeline pipeline = repository.get(uriInfo, id, fields);
    if (pipelineServiceClient == null) {
      return Response.status(200).entity("Pipeline Client Disabled").build();
    }
    decryptOrNullify(securityContext, pipeline, true);
    pipelineServiceClient.toggleIngestion(pipeline);
    Response response = createOrUpdate(uriInfo, securityContext, pipeline);
    decryptOrNullify(securityContext, (IngestionPipeline) response.getEntity(), false);
    return response;
  }

  public PipelineServiceClientResponse killIngestion(
      UUID id, UriInfo uriInfo, SecurityContext securityContext) {
    IngestionPipeline ingestionPipeline =
        getInternal(uriInfo, securityContext, id, FIELDS, Include.NON_DELETED);
    decryptOrNullify(securityContext, ingestionPipeline, true);
    if (pipelineServiceClient == null) {
      return new PipelineServiceClientResponse()
          .withCode(200)
          .withReason("Pipeline Client Disabled");
    }
    return pipelineServiceClient.killIngestion(ingestionPipeline);
  }

  public Response getHostIp() {
    if (pipelineServiceClient == null) {
      return Response.status(200).entity("Pipeline Client Disabled").build();
    }
    return pipelineServiceClient.getHostIp();
  }

  public PipelineServiceClientResponse getServiceStatus() {
    if (pipelineServiceClient == null) {
      return new PipelineServiceClientResponse()
          .withCode(200)
          .withReason("Pipeline Client Disabled");
    }
    return pipelineServiceClient.getServiceStatus();
  }

  public void decryptOrNullify(
      SecurityContext securityContext, IngestionPipeline ingestionPipeline, boolean forceNotMask) {
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    try {
      authorizer.authorize(
          securityContext,
          new OperationContext(Entity.INGESTION_PIPELINE, MetadataOperation.VIEW_ALL),
          getResourceContextById(ingestionPipeline.getId()));
    } catch (AuthorizationException e) {
      ingestionPipeline.getSourceConfig().setConfig(null);
    }
    secretsManager.decryptIngestionPipeline(ingestionPipeline);
    OpenMetadataConnection openMetadataServerConnection =
        new OpenMetadataConnectionBuilder(
                repository.getOpenMetadataApplicationConfig(), ingestionPipeline)
            .build();
    ingestionPipeline.setOpenMetadataServerConnection(
        secretsManager.encryptOpenMetadataConnection(openMetadataServerConnection, false));
    if (authorizer.shouldMaskPasswords(securityContext) && !forceNotMask) {
      EntityMaskerFactory.getEntityMasker().maskIngestionPipeline(ingestionPipeline);
    }
  }

  public static class IngestionPipelineList extends ResultList<IngestionPipeline> {
    /* Required for serde */
  }
}
