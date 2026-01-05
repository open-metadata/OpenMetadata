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

package org.openmetadata.service.services.datainsight;

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.DATA_INSIGHT_CUSTOM_CHART)
public class DataInsightSystemChartService
    extends EntityBaseService<DataInsightCustomChart, DataInsightSystemChartRepository> {

  @Inject
  public DataInsightSystemChartService(
      DataInsightSystemChartRepository repository, Authorizer authorizer, Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.DATA_INSIGHT_CUSTOM_CHART, DataInsightCustomChart.class),
        repository,
        authorizer,
        limits);
  }

  public void initialize() throws IOException {
    List<DataInsightCustomChart> diCharts =
        repository.getEntitiesFromSeedData(".*json/data/dataInsight/custom/.*\\.json$");
    for (DataInsightCustomChart diChart : diCharts) {
      repository.initializeEntity(diChart);
    }
  }

  public DataInsightCustomChartResultList getPreviewData(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String fqn,
      long start,
      long end,
      String filter)
      throws IOException {
    DataInsightCustomChart diChart = getByNameInternal(uriInfo, securityContext, fqn, null, null);
    return repository.getPreviewData(diChart, start, end, filter);
  }

  public Map<String, DataInsightCustomChartResultList> listChartData(
      String chartNames, long start, long end, String filter, boolean live, String serviceName)
      throws IOException {
    return repository.listChartData(chartNames, start, end, filter, live, serviceName);
  }

  public Map<String, Object> startChartDataStreaming(
      SecurityContext securityContext,
      String chartNames,
      String serviceName,
      String filter,
      String entityLink,
      Long startTime,
      Long endTime) {
    String username = securityContext.getUserPrincipal().getName();
    User user =
        Entity.getUserRepository().getByName(null, username, EntityUtil.Fields.EMPTY_FIELDS);
    return repository.startChartDataStreaming(
        chartNames, serviceName, filter, entityLink, user.getId(), startTime, endTime);
  }

  public Map<String, Object> stopChartDataStreaming(
      SecurityContext securityContext, String sessionId) {
    String username = securityContext.getUserPrincipal().getName();
    User user =
        Entity.getUserRepository().getByName(null, username, EntityUtil.Fields.EMPTY_FIELDS);
    return repository.stopChartDataStreaming(sessionId, user.getId());
  }

  public static class DataInsightCustomChartList extends ResultList<DataInsightCustomChart> {
    /* Required for serde */
  }
}
