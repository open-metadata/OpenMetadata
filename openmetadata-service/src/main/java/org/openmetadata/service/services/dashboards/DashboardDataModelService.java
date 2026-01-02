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

package org.openmetadata.service.services.dashboards;

import static org.openmetadata.common.utils.CommonUtil.listOf;

import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DashboardDataModelRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.datamodels.DashboardDataModelMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;

@Slf4j
@Singleton
@Service(entityType = Entity.DASHBOARD_DATA_MODEL)
public class DashboardDataModelService
    extends EntityBaseService<DashboardDataModel, DashboardDataModelRepository> {

  @Getter private final DashboardDataModelMapper mapper;
  public static final String FIELDS = "owners,tags,followers,domains,sourceHash,extension";

  @Inject
  public DashboardDataModelService(
      DashboardDataModelRepository repository,
      Authorizer authorizer,
      DashboardDataModelMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.DASHBOARD_DATA_MODEL, DashboardDataModel.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  public DashboardDataModel addHref(UriInfo uriInfo, DashboardDataModel dashboardDataModel) {
    super.addHref(uriInfo, dashboardDataModel);
    Entity.withHref(uriInfo, dashboardDataModel.getService());
    return dashboardDataModel;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    return listOf(MetadataOperation.EDIT_LINEAGE);
  }

  public static class DashboardDataModelList extends ResultList<DashboardDataModel> {
    /* Required for serde */
  }

  public static class DataModelColumnList extends ResultList<org.openmetadata.schema.type.Column> {
    /* Required for serde */
  }
}
