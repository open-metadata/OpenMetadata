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

package org.openmetadata.service.services.domains;

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.Map;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DataProductRepository;
import org.openmetadata.service.resources.domains.DataProductMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.DATA_PRODUCT)
public class DataProductService extends AbstractEntityService<DataProduct> {

  public static final String FIELDS =
      "domains,owners,reviewers,experts,extension,tags,followers,inputPorts,outputPorts";

  @Getter private final DataProductMapper mapper;
  private final DataProductRepository dataProductRepository;

  @Inject
  public DataProductService(
      DataProductRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      DataProductMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.DATA_PRODUCT);
    this.dataProductRepository = repository;
    this.mapper = mapper;
  }

  public DataProduct addHref(UriInfo uriInfo, DataProduct dataProduct) {
    Entity.withHref(uriInfo, dataProduct.getOwners());
    Entity.withHref(uriInfo, dataProduct.getFollowers());
    Entity.withHref(uriInfo, dataProduct.getExperts());
    Entity.withHref(uriInfo, dataProduct.getReviewers());
    Entity.withHref(uriInfo, dataProduct.getChildren());
    Entity.withHref(uriInfo, dataProduct.getDomains());
    Entity.withHref(uriInfo, dataProduct.getDataProducts());
    return dataProduct;
  }

  public BulkOperationResult bulkAddAssets(
      SecurityContext securityContext, String name, BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return dataProductRepository.bulkAddAssets(name, request);
  }

  public BulkOperationResult bulkRemoveAssets(
      SecurityContext securityContext, String name, BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return dataProductRepository.bulkRemoveAssets(name, request);
  }

  public BulkOperationResult bulkAddInputPorts(
      SecurityContext securityContext, String name, BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return dataProductRepository.bulkAddInputPorts(name, request);
  }

  public BulkOperationResult bulkRemoveInputPorts(
      SecurityContext securityContext, String name, BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return dataProductRepository.bulkRemoveInputPorts(name, request);
  }

  public BulkOperationResult bulkAddOutputPorts(
      SecurityContext securityContext, String name, BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return dataProductRepository.bulkAddOutputPorts(name, request);
  }

  public BulkOperationResult bulkRemoveOutputPorts(
      SecurityContext securityContext, String name, BulkAssets request) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
    return dataProductRepository.bulkRemoveOutputPorts(name, request);
  }

  public RestUtil.PutResponse<DataProduct> addFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return dataProductRepository.addFollower(
        securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<DataProduct> deleteFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return dataProductRepository.deleteFollower(
        securityContext.getUserPrincipal().getName(), id, userId);
  }

  public ResultList<EntityReference> getDataProductAssets(UUID id, int limit, int offset) {
    return dataProductRepository.getDataProductAssets(id, limit, offset);
  }

  public ResultList<EntityReference> getDataProductAssetsByName(String fqn, int limit, int offset) {
    return dataProductRepository.getDataProductAssetsByName(fqn, limit, offset);
  }

  public Map<String, Integer> getAllDataProductsWithAssetsCount() {
    return dataProductRepository.getAllDataProductsWithAssetsCount();
  }

  public static class DataProductList extends ResultList<DataProduct> {
    @SuppressWarnings("unused")
    public DataProductList() {}
  }

  @Override
  protected ResourceContext getResourceContextByName(String name) {
    return new ResourceContext(entityType, null, name);
  }
}
