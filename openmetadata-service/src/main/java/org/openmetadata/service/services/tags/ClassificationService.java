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

package org.openmetadata.service.services.tags;

import java.util.List;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ClassificationRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.tags.ClassificationMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;

@Slf4j
@Singleton
@Service(entityType = Entity.CLASSIFICATION)
public class ClassificationService
    extends EntityBaseService<Classification, ClassificationRepository> {
  public static final String FIELDS =
      "owners,reviewers,usageCount,termCount,autoClassificationConfig";

  @Getter private final ClassificationMapper mapper;

  @Inject
  public ClassificationService(
      ClassificationRepository repository,
      Authorizer authorizer,
      ClassificationMapper mapper,
      Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.CLASSIFICATION, Classification.class),
        repository,
        authorizer,
        limits);
    this.mapper = mapper;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("reviewers,usageCount,termCount", MetadataOperation.VIEW_BASIC);
    return null;
  }

  public static class ClassificationList extends ResultList<Classification> {
    /* Required for serde */
  }
}
