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

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateFile;
import org.openmetadata.schema.entity.data.File;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.FileRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.drives.FileMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;

@Slf4j
@Singleton
@Service(entityType = Entity.FILE)
public class FileService extends EntityBaseService<File, FileRepository> {

  @Getter private final FileMapper mapper;
  public static final String FIELDS =
      "owners,directory,usageSummary,tags,fileExtension,extension,domains,sourceHash,lifeCycle,votes,followers";

  @Inject
  public FileService(
      FileRepository repository, Authorizer authorizer, FileMapper mapper, Limits limits) {
    super(new ResourceEntityInfo<>(Entity.FILE, File.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  @Override
  public File addHref(UriInfo uriInfo, File file) {
    super.addHref(uriInfo, file);
    Entity.withHref(uriInfo, file.getDirectory());
    Entity.withHref(uriInfo, file.getService());
    return file;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("directory", MetadataOperation.VIEW_BASIC);
    addViewOperation("usageSummary", MetadataOperation.VIEW_USAGE);
    return listOf(MetadataOperation.VIEW_USAGE, MetadataOperation.EDIT_USAGE);
  }

  public Response updateVote(String updatedBy, UUID id, VoteRequest request) {
    return repository.updateVote(updatedBy, id, request).toResponse();
  }

  public Response bulkCreateOrUpdate(
      UriInfo uriInfo,
      SecurityContext securityContext,
      List<CreateFile> createRequests,
      EntityMapper<File, CreateFile> entityMapper,
      boolean async) {
    return processBulkRequest(uriInfo, securityContext, createRequests, entityMapper, async);
  }

  public static class FileList extends ResultList<File> {
    /* Required for serde */
  }
}
