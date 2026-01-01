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

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.CLASSIFICATION;

import java.util.ArrayList;
import java.util.List;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.classification.LoadTags;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ClassificationRepository;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.TagRepository;
import org.openmetadata.service.resources.tags.TagMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.TAG)
public class TagService extends AbstractEntityService<Tag> {

  @Getter private final TagMapper mapper;
  private final TagRepository tagRepository;
  private final ClassificationService classificationService;

  @Inject
  public TagService(
      TagRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      TagMapper mapper,
      ClassificationService classificationService) {
    super(repository, searchRepository, authorizer, Entity.TAG);
    this.tagRepository = repository;
    this.mapper = mapper;
    this.classificationService = classificationService;
  }

  public void initialize() {
    ClassificationRepository classificationRepository =
        (ClassificationRepository) Entity.getEntityRepository(CLASSIFICATION);
    List<LoadTags> loadTagsList =
        EntityRepository.getEntitiesFromSeedData(
            CLASSIFICATION, ".*json/data/tags/.*\\.json$", LoadTags.class);
    for (LoadTags loadTags : loadTagsList) {
      Classification classification =
          classificationService
              .getMapper()
              .createToEntity(loadTags.getCreateClassification(), ADMIN_USER_NAME);
      classificationRepository.initializeEntity(classification);

      List<Tag> tagsToCreate = new ArrayList<>();
      for (CreateTag createTag : loadTags.getCreateTags()) {
        createTag.withClassification(classification.getName());
        createTag.withProvider(classification.getProvider());
        Tag tag = mapper.createToEntity(createTag, ADMIN_USER_NAME);
        tagRepository.setFullyQualifiedName(tag);
        tagsToCreate.add(tag);
      }

      EntityUtil.sortByFQN(tagsToCreate);

      for (Tag tag : tagsToCreate) {
        tagRepository.initializeEntity(tag);
      }
    }
  }
}
