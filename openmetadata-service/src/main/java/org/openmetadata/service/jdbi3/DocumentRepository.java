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

import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entities.docStore.Document;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.docstore.DocStoreResource;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public class DocumentRepository extends EntityRepository<Document> {
  static final String DOCUMENT_UPDATE_FIELDS = "data";
  static final String DOCUMENT_PATCH_FIELDS = "data";

  public DocumentRepository() {
    super(
        DocStoreResource.COLLECTION_PATH,
        DOCUMENT,
        Document.class,
        Entity.getCollectionDAO().docStoreDAO(),
        DOCUMENT_UPDATE_FIELDS,
        DOCUMENT_PATCH_FIELDS);
    supportsSearch = false;
  }

  @Override
  public void setFullyQualifiedName(Document doc) {
    doc.setFullyQualifiedName(doc.getFullyQualifiedName());
  }

  @Override
  public Document setFields(Document document, Fields fields) {
    return document;
  }

  @Override
  public Document clearFields(Document document, Fields fields) {
    return document;
  }

  @Override
  public void prepare(Document document, boolean update) {
    // validations are not implemented for Document
  }

  @Override
  public void storeEntity(Document document, boolean update) {
    store(document, update);
  }

  @Override
  public void storeRelationships(Document entity) {
    // validations are not implemented for Document
  }

  @Override
  public DocumentUpdater getUpdater(Document original, Document updated, Operation operation) {
    return new DocumentUpdater(original, updated, operation);
  }

  /** Handles entity updated from PUT and POST operation. */
  public class DocumentUpdater extends EntityUpdater {
    public DocumentUpdater(Document original, Document updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate() {
      recordChange("data", original.getData(), updated.getData(), true);
    }
  }
}
