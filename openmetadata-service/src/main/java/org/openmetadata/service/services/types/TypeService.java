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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.Category;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TypeRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.types.TypeMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.RestUtil.PutResponse;
import org.openmetadata.service.util.SchemaFieldExtractor;

@Slf4j
@Singleton
@Service(entityType = Entity.TYPE)
public class TypeService extends EntityBaseService<Type, TypeRepository> {

  @Getter private final TypeMapper mapper;
  public static final String FIELDS = "customProperties";
  private final SchemaFieldExtractor extractor;

  @Inject
  public TypeService(
      TypeRepository repository, Authorizer authorizer, TypeMapper mapper, Limits limits) {
    super(new ResourceEntityInfo<>(Entity.TYPE, Type.class), repository, authorizer, limits);
    this.mapper = mapper;
    this.extractor = new SchemaFieldExtractor();
  }

  public void initialize() {
    long now = System.currentTimeMillis();
    List<Type> types = JsonUtils.getTypes();
    Fields fields = repository.getFields(FIELDS);
    types.forEach(
        type -> {
          type.withId(UUID.randomUUID()).withUpdatedBy(ADMIN_USER_NAME).withUpdatedAt(now);
          LOG.debug("Loading type {}", type.getName());
          try {
            try {
              Type storedType = repository.getByName(null, type.getName(), fields);
              type.setId(storedType.getId());
              if (storedType.getCategory().equals(Category.Entity)) {
                type.setCustomProperties(storedType.getCustomProperties());
              }
            } catch (Exception e) {
              LOG.debug(
                  "Type '{}' not found. Proceeding to add new type entity in database.",
                  type.getName());
            }
            repository.createOrUpdate(null, type, ADMIN_USER_NAME);
            repository.addToRegistry(type);
          } catch (Exception e) {
            LOG.error("Error loading type {}", type.getName(), e);
          }
        });
  }

  @Override
  public Type addHref(UriInfo uriInfo, Type type) {
    listOrEmpty(type.getCustomProperties())
        .forEach(property -> Entity.withHref(uriInfo, property.getPropertyType()));
    return type;
  }

  public Type getByNameWithCustomAuth(
      UriInfo uriInfo,
      SecurityContext securityContext,
      String name,
      String fieldsParam,
      Include include) {
    Fields fields = getFields(fieldsParam);
    if (fields.getFieldList().contains("customProperties")) {
      try {
        if (Entity.entityHasField(name, Entity.FIELD_EXTENSION)) {
          OperationContext operationContext =
              new OperationContext(name, MetadataOperation.VIEW_CUSTOM_FIELDS);
          ResourceContext<?> resourceContext = new ResourceContext<>(name);
          authorizer.authorize(securityContext, operationContext, resourceContext);
          return addHref(uriInfo, repository.getByName(uriInfo, name, fields, include, false));
        }
      } catch (EntityNotFoundException e) {
        // Not a valid entity type supporting customProperties, fall through to standard Type
        // authorization
      }
    }
    return getByNameInternal(uriInfo, securityContext, name, fieldsParam, include);
  }

  public PutResponse<Type> addOrUpdateCustomProperty(
      UriInfo uriInfo, SecurityContext securityContext, UUID id, CustomProperty property) {
    OperationContext operationContext = new OperationContext(entityType, MetadataOperation.CREATE);
    authorizer.authorize(securityContext, operationContext, getResourceContextById(id));
    PutResponse<Type> response =
        repository.addCustomProperty(
            uriInfo, securityContext.getUserPrincipal().getName(), id, property);
    addHref(uriInfo, response.getEntity());
    return response;
  }

  public List<SchemaFieldExtractor.FieldDefinition> getEntityTypeFields(
      UriInfo uriInfo, String entityType, Include include) {
    Fields fieldsParam = new Fields(Set.of("customProperties"));
    Type typeEntity = repository.getByName(uriInfo, entityType, fieldsParam, include, false);
    return extractor.extractFields(typeEntity, entityType);
  }

  public Map<String, List<SchemaFieldExtractor.FieldDefinition>> getAllCustomPropertiesByEntityType(
      UriInfo uriInfo) {
    return extractor.extractAllCustomProperties(uriInfo, repository);
  }

  public List<CustomProperty> getCustomPropertiesForEntityType(
      UriInfo uriInfo, String entityType, Include include) {
    Fields fieldsParam = new Fields(Set.of("customProperties"));
    Type typeEntity = repository.getByName(uriInfo, entityType, fieldsParam, include, false);
    return listOrEmpty(typeEntity.getCustomProperties());
  }

  public static class TypeList extends ResultList<Type> {
    /* Required for serde */
  }
}
