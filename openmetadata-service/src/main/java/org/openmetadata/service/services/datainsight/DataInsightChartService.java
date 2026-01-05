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

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.io.IOException;
import java.util.List;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.schema.dataInsight.DataInsightChartResult;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DataInsightChartRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.datainsight.DataInsightChartMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.services.Service;

/**
 * Service layer for DataInsightChart entity operations.
 *
 * <p>Extends EntityBaseService to inherit all standard CRUD operations with proper authorization
 * and repository delegation.
 */
@Slf4j
@Singleton
@Service(entityType = Entity.DATA_INSIGHT_CHART)
public class DataInsightChartService
    extends EntityBaseService<DataInsightChart, DataInsightChartRepository> {

  @Getter private final DataInsightChartMapper mapper;
  private final SearchRepository searchRepository;
  public static final String FIELDS = "owners";

  @Inject
  public DataInsightChartService(
      DataInsightChartRepository repository,
      Authorizer authorizer,
      DataInsightChartMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.DATA_INSIGHT_CHART, DataInsightChart.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
    this.searchRepository = Entity.getSearchRepository();
  }

  public void initialize() throws IOException {
    List<DataInsightChart> dataInsightCharts =
        repository.getEntitiesFromSeedData(".*json/data/dataInsight/.*\\.json$");
    for (DataInsightChart dataInsightChart : dataInsightCharts) {
      repository.initializeEntity(dataInsightChart);
    }
  }

  public Response listDataInsightChartResult(
      SecurityContext securityContext,
      Long startTs,
      Long endTs,
      String tier,
      String team,
      DataInsightChartResult.DataInsightChartType dataInsightChartName,
      Integer size,
      Integer from,
      String queryFilter,
      String dataReportIndex)
      throws IOException {
    OperationContext operationContext =
        new OperationContext(Entity.DATA_INSIGHT_CHART, MetadataOperation.VIEW_ALL);
    authorizer.authorize(securityContext, operationContext, getResourceContext());
    return searchRepository.listDataInsightChartResult(
        startTs, endTs, tier, team, dataInsightChartName, size, from, queryFilter, dataReportIndex);
  }

  public static class DataInsightChartList extends ResultList<DataInsightChart> {
    /* Required for serde */
  }

  public static class DataInsightChartResultList extends ResultList<DataInsightChartResult> {
    /* Required for serde */
  }
}
