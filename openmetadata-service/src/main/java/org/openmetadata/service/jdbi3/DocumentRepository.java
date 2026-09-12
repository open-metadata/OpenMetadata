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
package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.DOCUMENT;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.email.EmailTemplate;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.email.TemplateValidationResponse;
import org.openmetadata.schema.entities.docStore.Data;
import org.openmetadata.schema.entities.docStore.Document;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.resources.docstore.DocStoreResource;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.email.DefaultTemplateProvider;
import org.openmetadata.service.util.email.TemplateProvider;

@Slf4j
@Repository()
public class DocumentRepository implements EntityPolicy<Document> {

  static final String DOCUMENT_UPDATE_FIELDS = "data";

  static final String DOCUMENT_PATCH_FIELDS = "data";

  private final CollectionDAO.DocStoreDAO dao;

  private final TemplateProvider templateProvider;

  private final String COLLATE = "collate";

  public DocumentRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                DocStoreResource.COLLECTION_PATH,
                DOCUMENT,
                Document.class,
                Entity.getCollectionDAO().docStoreDAO()),
            new EntityPolicyContext.WriteFields(
                DOCUMENT_UPDATE_FIELDS, DOCUMENT_PATCH_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setSupportsSearch(false);
    this.dao = Entity.getCollectionDAO().docStoreDAO();
    this.templateProvider = new DefaultTemplateProvider();
  }

  @Override
  public List<Document> getEntitiesFromSeedData() throws IOException {
    List<Document> entitiesFromSeedData = new ArrayList<>();
    SmtpSettings emailConfig =
        SettingsCache.getSetting(SettingsType.EMAIL_CONFIGURATION, SmtpSettings.class);
    if (emailConfig.getTemplates().value().equals(COLLATE)) {
      entitiesFromSeedData.addAll(
          getEntitiesFromSeedData(
              String.format(
                  ".*json/data/%s/emailTemplates/collate/.*\\.json$",
                  context().schema().entityType())));
    } else {
      entitiesFromSeedData.addAll(
          getEntitiesFromSeedData(
              String.format(
                  ".*json/data/%s/emailTemplates/openmetadata/.*\\.json$",
                  context().schema().entityType())));
    }
    entitiesFromSeedData.addAll(
        getEntitiesFromSeedData(
            String.format(".*json/data/%s/docs/.*\\.json$", context().schema().entityType())));
    return entitiesFromSeedData;
  }

  public List<Document> fetchAllEmailTemplates() {
    List<String> jsons = dao.fetchAllEmailTemplates();
    return jsons.stream().map(json -> JsonUtils.readValue(json, Document.class)).toList();
  }

  public EmailTemplate fetchEmailTemplateByName(String name) {
    String json = dao.fetchEmailTemplateByName(name);
    if (json == null) {
      throw new EntityNotFoundException("Email template not found with name : " + name);
    }
    Document document = JsonUtils.readValue(json, Document.class);
    return JsonUtils.convertValue(document.getData(), EmailTemplate.class);
  }

  @Transaction
  public void deleteEmailTemplates() {
    dao.deleteEmailTemplates();
  }

  @Override
  public void setFullyQualifiedName(Document doc) {
    doc.setFullyQualifiedName(doc.getFullyQualifiedName());
  }

  @Override
  public void setFields(Document document, Fields fields, RelationIncludes relationIncludes) {
    /* Nothing to do */
  }

  @Override
  public void clearFields(Document document, Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void prepare(Document document, boolean update) {
    // validations are not implemented for Document
  }

  @Override
  public void storeEntity(Document document, boolean update) {
    persistence().store(document, update);
  }

  @Override
  public void storeRelationships(Document entity) {
    // validations are not implemented for Document
  }

  public TemplateValidationResponse validateEmailTemplate(String name, String content) {
    return templateProvider.validateEmailTemplate(name, content);
  }

  @Override
  public EntityUpdater<Document> getUpdater(
      Document original, Document updated, EntityOperation operation, ChangeSource changeSource) {
    return new DocumentUpdater(original, updated, operation).mutation();
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class DocumentUpdater implements EntitySpecificMutation<Document> {

    public DocumentUpdater(Document original, Document updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Transaction
    @Override
    public void update(EntityUpdater<Document> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "data",
          () -> {
            updateEmailTemplatePlaceholders(entityUpdate.getOriginal(), entityUpdate.getUpdated());
            entityUpdate.recordChange(
                "data",
                entityUpdate.getOriginal().getData(),
                entityUpdate.getUpdated().getData(),
                true);
          });
    }

    private final EntityUpdater<Document> entityUpdate;

    public EntityUpdater<Document> mutation() {
      return entityUpdate;
    }
  }

  public void updateEmailTemplatePlaceholders(Document original, Document updated) {
    if (updated.getEntityType().equals(DefaultTemplateProvider.ENTITY_TYPE_EMAIL_TEMPLATE)) {
      EmailTemplate originalTemplate =
          JsonUtils.convertValue(original.getData(), EmailTemplate.class);
      EmailTemplate updatedTemplate =
          JsonUtils.convertValue(updated.getData(), EmailTemplate.class);
      updatedTemplate.setPlaceHolders(originalTemplate.getPlaceHolders());
      updated.setData(JsonUtils.convertValue(updatedTemplate, Data.class));
    }
  }

  private final EntityPolicyContext<Document> entityContext;

  @Override
  public final EntityPolicyContext<Document> context() {
    return entityContext;
  }
}
