package org.openmetadata.service.resources.docstore;

import jakarta.ws.rs.core.Response;
import org.openmetadata.schema.email.EmailTemplate;
import org.openmetadata.schema.email.TemplateValidationResponse;
import org.openmetadata.schema.entities.docStore.CreateDocument;
import org.openmetadata.schema.entities.docStore.Document;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.jdbi3.DocumentRepository;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.util.email.DefaultTemplateProvider;

public class DocStoreMapper implements EntityMapper<Document, CreateDocument> {
  @Override
  public Document createToEntity(CreateDocument create, String user) {
    DocumentRepository documentRepository =
        (DocumentRepository) Entity.getEntityRepository(Entity.DOCUMENT);
    if (create.getEntityType().equals(DefaultTemplateProvider.ENTITY_TYPE_EMAIL_TEMPLATE)) {
      String content = JsonUtils.convertValue(create.getData(), EmailTemplate.class).getTemplate();
      TemplateValidationResponse validationResp =
          documentRepository.validateEmailTemplate(create.getName(), content);
      if (Boolean.FALSE.equals(validationResp.getIsValid())) {
        throw new CustomExceptionMessage(
            Response.status(400).entity(validationResp).build(), validationResp.getMessage());
      }
    }
    return copy(new Document(), create, user)
        .withFullyQualifiedName(create.getFullyQualifiedName())
        .withData(create.getData())
        .withEntityType(create.getEntityType());
  }
}
