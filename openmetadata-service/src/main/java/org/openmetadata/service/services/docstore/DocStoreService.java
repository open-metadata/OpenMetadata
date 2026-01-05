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

package org.openmetadata.service.services.docstore;

import static org.openmetadata.common.utils.CommonUtil.listOf;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import jakarta.ws.rs.core.UriInfo;
import java.io.IOException;
import java.util.List;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.email.EmailTemplate;
import org.openmetadata.schema.email.TemplateValidationResponse;
import org.openmetadata.schema.entities.docStore.CreateDocument;
import org.openmetadata.schema.entities.docStore.Document;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.jdbi3.DocumentRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.docstore.DocStoreMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.email.DefaultTemplateProvider;

@Slf4j
@Singleton
@Service(entityType = Entity.DOCUMENT)
public class DocStoreService extends EntityBaseService<Document, DocumentRepository> {

  @Getter private final DocStoreMapper mapper;

  @Inject
  public DocStoreService(
      DocumentRepository repository, Authorizer authorizer, DocStoreMapper mapper, Limits limits) {
    super(
        new ResourceEntityInfo<>(Entity.DOCUMENT, Document.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  public Document createDocumentFromRequest(
      CreateDocument create, SecurityContext securityContext) {
    String user = securityContext.getUserPrincipal().getName();
    if (create.getEntityType().equals(DefaultTemplateProvider.ENTITY_TYPE_EMAIL_TEMPLATE)) {
      authorizer.authorizeAdmin(securityContext);
      String content = JsonUtils.convertValue(create.getData(), EmailTemplate.class).getTemplate();
      TemplateValidationResponse validationResp =
          repository.validateEmailTemplate(create.getName(), content);
      if (Boolean.FALSE.equals(validationResp.getIsValid())) {
        throw new CustomExceptionMessage(
            Response.status(400).entity(validationResp).build(), validationResp.getMessage());
      }
    }
    return mapper.createToEntity(create, user);
  }

  @Override
  public Document addHref(UriInfo uriInfo, Document doc) {
    super.addHref(uriInfo, doc);
    return doc;
  }

  @Override
  protected List<MetadataOperation> getEntitySpecificOperations() {
    addViewOperation("data", MetadataOperation.VIEW_BASIC);
    return listOf(MetadataOperation.EDIT_ALL);
  }

  public void initialize() throws IOException {
    repository.initSeedDataFromResources();
  }

  public TemplateValidationResponse validateEmailTemplate(
      SecurityContext securityContext, String templateName, EmailTemplate emailTemplate) {
    authorizer.authorizeAdmin(securityContext);
    return repository.validateEmailTemplate(templateName, emailTemplate.getTemplate());
  }

  public Response resetEmailTemplate() {
    try {
      repository.deleteEmailTemplates();
      repository.initSeedDataFromResources();
      return Response.ok("Seed Data init successfully").build();
    } catch (Exception e) {
      LOG.error(e.getMessage());
      return Response.status(Response.Status.BAD_REQUEST)
          .entity("Seed Data init failed: " + e.getMessage())
          .build();
    }
  }

  public static class DocumentList extends ResultList<Document> {
    /* Required for serde */
  }
}
