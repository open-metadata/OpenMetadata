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

package org.openmetadata.service.services.types;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.Category;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TypeRepository;
import org.openmetadata.service.resources.types.TypeMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
@Singleton
@Service(entityType = Entity.TYPE)
public class TypeService extends AbstractEntityService<Type> {

  @Getter private final TypeMapper mapper;
  private final TypeRepository typeRepository;
  private static final String PROPERTIES_FIELD = "customProperties";

  @Inject
  public TypeService(
      TypeRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      TypeMapper mapper) {
    super(repository, searchRepository, authorizer, Entity.TYPE);
    this.typeRepository = repository;
    this.mapper = mapper;
  }

  public void initialize() {
    long now = System.currentTimeMillis();
    List<Type> types = JsonUtils.getTypes();
    Fields fields = typeRepository.getFields(PROPERTIES_FIELD);
    types.forEach(
        type -> {
          type.withId(UUID.randomUUID()).withUpdatedBy(ADMIN_USER_NAME).withUpdatedAt(now);
          LOG.debug("Loading type {}", type.getName());
          try {
            try {
              Type storedType = typeRepository.getByName(null, type.getName(), fields);
              type.setId(storedType.getId());
              if (storedType.getCategory().equals(Category.Entity)) {
                type.setCustomProperties(storedType.getCustomProperties());
              }
            } catch (Exception e) {
              LOG.debug(
                  "Type '{}' not found. Proceeding to add new type entity in database.",
                  type.getName());
            }
            typeRepository.createOrUpdate(null, type, ADMIN_USER_NAME);
            typeRepository.addToRegistry(type);
          } catch (Exception e) {
            LOG.error("Error loading type {}", type.getName(), e);
          }
        });
  }
}
