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
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.domains.DataProductMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.DATA_PRODUCT)
public class DataProductService extends EntityBaseService<DataProduct, DataProductRepository> {

  public static final String FIELDS =
      "domains,owners,reviewers,experts,extension,tags,followers,inputPorts,outputPorts";

  @Getter private final DataProductMapper mapper;

  @Inject
  public DataProductService(
      DataProductRepository repository,
      Authorizer authorizer,
      DataProductMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.DATA_PRODUCT, DataProduct.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  public DataProduct addHref(UriInfo uriInfo, DataProduct dataProduct) {
    super.addHref(uriInfo, dataProduct);
    Entity.withHref(uriInfo, dataProduct.getExperts());
    Entity.withHref(uriInfo, dataProduct.getInputPorts());
    Entity.withHref(uriInfo, dataProduct.getOutputPorts());
    return dataProduct;
  }

  public BulkOperationResult bulkAddAssets(
      SecurityContext securityContext, String name, BulkAssets request) {
    authorizeEditAll(securityContext, name);
    return repository.bulkAddAssets(name, request);
  }

  public BulkOperationResult bulkRemoveAssets(
      SecurityContext securityContext, String name, BulkAssets request) {
    authorizeEditAll(securityContext, name);
    return repository.bulkRemoveAssets(name, request);
  }

  public BulkOperationResult bulkAddInputPorts(
      SecurityContext securityContext, String name, BulkAssets request) {
    authorizeEditAll(securityContext, name);
    return repository.bulkAddInputPorts(name, request);
  }

  public BulkOperationResult bulkRemoveInputPorts(
      SecurityContext securityContext, String name, BulkAssets request) {
    authorizeEditAll(securityContext, name);
    return repository.bulkRemoveInputPorts(name, request);
  }

  public BulkOperationResult bulkAddOutputPorts(
      SecurityContext securityContext, String name, BulkAssets request) {
    authorizeEditAll(securityContext, name);
    return repository.bulkAddOutputPorts(name, request);
  }

  public BulkOperationResult bulkRemoveOutputPorts(
      SecurityContext securityContext, String name, BulkAssets request) {
    authorizeEditAll(securityContext, name);
    return repository.bulkRemoveOutputPorts(name, request);
  }

  public RestUtil.PutResponse<DataProduct> addDataProductFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return addFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public RestUtil.PutResponse<DataProduct> deleteDataProductFollower(
      SecurityContext securityContext, UUID id, UUID userId) {
    return deleteFollower(securityContext.getUserPrincipal().getName(), id, userId);
  }

  public ResultList<EntityReference> getDataProductAssets(UUID id, int limit, int offset) {
    return repository.getDataProductAssets(id, limit, offset);
  }

  public ResultList<EntityReference> getDataProductAssetsByName(String fqn, int limit, int offset) {
    return repository.getDataProductAssetsByName(fqn, limit, offset);
  }

  public Map<String, Integer> getAllDataProductsWithAssetsCount() {
    return repository.getAllDataProductsWithAssetsCount();
  }

  private void authorizeEditAll(SecurityContext securityContext, String name) {
    OperationContext operationContext =
        new OperationContext(entityType, MetadataOperation.EDIT_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContextByName(name));
  }

  public static class DataProductList extends ResultList<DataProduct> {
    @SuppressWarnings("unused")
    public DataProductList() {}
  }
}
