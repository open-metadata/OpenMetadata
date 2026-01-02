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

package org.openmetadata.service.services.drives;

import static org.openmetadata.common.utils.CommonUtil.listOf;

import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorksheetRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.drives.WorksheetMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;

@Slf4j
@Singleton
@Service(entityType = Entity.WORKSHEET)
public class WorksheetService extends EntityBaseService<Worksheet, WorksheetRepository> {

  @Getter private final WorksheetMapper mapper;
  public static final String FIELDS =
      "owners,spreadsheet,columns,sampleData,usageSummary,tags,extension,domains,sourceHash,lifeCycle,votes,followers,rowCount";

  @Inject
  public WorksheetService(
      WorksheetRepository repository,
      Authorizer authorizer,
      WorksheetMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.WORKSHEET, Worksheet.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  public Worksheet addHref(UriInfo uriInfo, Worksheet worksheet) {
    super.addHref(uriInfo, worksheet);
    Entity.withHref(uriInfo, worksheet.getSpreadsheet());
    Entity.withHref(uriInfo, worksheet.getService());
    return worksheet;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("spreadsheet", MetadataOperation.VIEW_BASIC);
    addViewOperation("columns", MetadataOperation.VIEW_BASIC);
    addViewOperation("sampleData", MetadataOperation.VIEW_SAMPLE_DATA);
    addViewOperation("usageSummary", MetadataOperation.VIEW_USAGE);
    return listOf(
        MetadataOperation.VIEW_USAGE, MetadataOperation.EDIT_USAGE,
        MetadataOperation.VIEW_SAMPLE_DATA, MetadataOperation.EDIT_SAMPLE_DATA);
  }

  public static class WorksheetList extends ResultList<Worksheet> {
    /* Required for serde */
  }
}
