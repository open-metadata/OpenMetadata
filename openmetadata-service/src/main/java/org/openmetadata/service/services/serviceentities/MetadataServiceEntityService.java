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

package org.openmetadata.service.services.serviceentities;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.MetadataConnection;
import org.openmetadata.schema.entity.services.MetadataService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.services.connections.metadata.ComponentConfig;
import org.openmetadata.schema.services.connections.metadata.ElasticsSearch;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.MetadataServiceRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.ServiceEntityInfo;
import org.openmetadata.service.resources.services.ServiceEntityResource;
import org.openmetadata.service.resources.services.metadata.MetadataServiceMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

@Slf4j
@Singleton
@Service(entityType = Entity.METADATA_SERVICE)
public class MetadataServiceEntityService
    extends ServiceEntityResource<MetadataService, MetadataServiceRepository, MetadataConnection> {
  public static final String FIELDS = "pipelines,owners,tags,domains,followers";

  @Getter private final MetadataServiceMapper mapper;

  @Inject
  public MetadataServiceEntityService(
      MetadataServiceRepository repository,
      Authorizer authorizer,
      MetadataServiceMapper mapper,
      Limits limits) {
    super(
        new ServiceEntityInfo<>(
            Entity.METADATA_SERVICE, ServiceType.METADATA, MetadataService.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  public MetadataService addHref(UriInfo uriInfo, MetadataService metadataService) {
    super.addHref(uriInfo, metadataService);
    Entity.withHref(uriInfo, metadataService.getOwners());
    return metadataService;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("pipelines", MetadataOperation.VIEW_BASIC);
    return null;
  }

  @Override
  protected MetadataService nullifyConnection(MetadataService service) {
    return service.withConnection(null);
  }

  @Override
  protected String extractServiceType(MetadataService service) {
    return service.getServiceType().value();
  }

  public MetadataService addTestConnectionResult(
      SecurityContext securityContext, UUID serviceId, TestConnectionResult testConnectionResult) {
    OperationContext operationContext =
        new OperationContext(getEntityType(), MetadataOperation.CREATE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(serviceId));
    MetadataService service = repository.addTestConnectionResult(serviceId, testConnectionResult);
    return decryptOrNullify(securityContext, service);
  }

  public void initialize(OpenMetadataApplicationConfig config) throws IOException {
    registerMetadataServices(config);
  }

  private void registerMetadataServices(OpenMetadataApplicationConfig config) throws IOException {
    List<MetadataService> servicesList =
        repository.getEntitiesFromSeedData(".*json/data/metadataService/OpenmetadataService.json$");
    if (!nullOrEmpty(servicesList)) {
      MetadataService openMetadataService = servicesList.get(0);
      openMetadataService.setId(UUID.randomUUID());
      openMetadataService.setUpdatedBy(ADMIN_USER_NAME);
      openMetadataService.setUpdatedAt(System.currentTimeMillis());
      if (config.getElasticSearchConfiguration() != null) {
        OpenMetadataConnection openMetadataServerConnection =
            new OpenMetadataConnectionBuilder(config)
                .build()
                .withElasticsSearch(
                    getElasticSearchConnectionSink(config.getElasticSearchConfiguration()));
        MetadataConnection metadataConnection =
            new MetadataConnection().withConfig(openMetadataServerConnection);
        openMetadataService.setConnection(metadataConnection);
      } else {
        LOG.error("[MetadataService] Missing Elastic Search Config.");
      }
      repository.setFullyQualifiedName(openMetadataService);
      repository.createOrUpdate(null, openMetadataService, ADMIN_USER_NAME);
    } else {
      throw new IOException("Failed to initialize OpenMetadata Service.");
    }
  }

  private ElasticsSearch getElasticSearchConnectionSink(ElasticSearchConfiguration esConfig)
      throws IOException {
    if (Objects.nonNull(esConfig)) {
      ElasticsSearch sink = new ElasticsSearch();
      ComponentConfig componentConfig = new ComponentConfig();
      sink.withType("elasticsearch")
          .withConfig(
              componentConfig
                  .withAdditionalProperty("es_host", esConfig.getHost())
                  .withAdditionalProperty("es_port", esConfig.getPort().toString())
                  .withAdditionalProperty("es_username", esConfig.getUsername())
                  .withAdditionalProperty("es_password", esConfig.getPassword())
                  .withAdditionalProperty("scheme", esConfig.getScheme()));
      return sink;
    } else {
      throw new IOException("Elastic Search Configuration Missing");
    }
  }

  public static class MetadataServiceList extends ResultList<MetadataService> {
    /* Required for serde */
  }
}
