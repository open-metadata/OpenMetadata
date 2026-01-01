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

import java.util.List;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DataInsightChartRepository;
import org.openmetadata.service.resources.datainsight.DataInsightChartMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;

/**
 * Service layer for DataInsightChart entity operations.
 *
 * <p>Extends AbstractEntityService to inherit all standard CRUD operations with proper
 * authorization and repository delegation.
 */
@Slf4j
@Singleton
@Service(entityType = Entity.DATA_INSIGHT_CHART)
public class DataInsightChartService extends AbstractEntityService<DataInsightChart> {

  @Getter private final DataInsightChartMapper mapper;
  private final DataInsightChartRepository dataInsightChartRepository;

  @Inject
  public DataInsightChartService(
      DataInsightChartRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      DataInsightChartMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.DATA_INSIGHT_CHART);
    this.dataInsightChartRepository = repository;
    this.mapper = mapper;
  }

  public void initialize() {
    List<DataInsightChart> dataInsightCharts =
        dataInsightChartRepository.getEntitiesFromSeedData(".*json/data/dataInsight/.*\\.json$");
    for (DataInsightChart dataInsightChart : dataInsightCharts) {
      dataInsightChartRepository.initializeEntity(dataInsightChart);
    }
  }
}
