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
import org.openmetadata.schema.entity.data.Spreadsheet;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SpreadsheetRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.drives.SpreadsheetMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;

/**
 * Service layer for Spreadsheet entity operations.
 *
 * <p>Extends EntityBaseService to inherit all standard CRUD operations with proper authorization
 * and repository delegation.
 */
@Slf4j
@Singleton
@Service(entityType = Entity.SPREADSHEET)
public class SpreadsheetService extends EntityBaseService<Spreadsheet, SpreadsheetRepository> {
  @Getter private final SpreadsheetMapper mapper;
  public static final String FIELDS =
      "owners,directory,worksheets,usageSummary,tags,extension,domains,sourceHash,lifeCycle,votes,followers,mimeType,createdTime,modifiedTime";

  @Inject
  public SpreadsheetService(
      SpreadsheetRepository repository,
      Authorizer authorizer,
      SpreadsheetMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.SPREADSHEET, Spreadsheet.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  public Spreadsheet addHref(UriInfo uriInfo, Spreadsheet spreadsheet) {
    super.addHref(uriInfo, spreadsheet);
    Entity.withHref(uriInfo, spreadsheet.getDirectory());
    Entity.withHref(uriInfo, spreadsheet.getService());
    Entity.withHref(uriInfo, spreadsheet.getWorksheets());
    return spreadsheet;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("directory", MetadataOperation.VIEW_BASIC);
    addViewOperation("worksheets", MetadataOperation.VIEW_BASIC);
    addViewOperation("usageSummary", MetadataOperation.VIEW_USAGE);
    return listOf(MetadataOperation.VIEW_USAGE, MetadataOperation.EDIT_USAGE);
  }

  public static class SpreadsheetList extends ResultList<Spreadsheet> {
    /* Required for serde */
  }
}
