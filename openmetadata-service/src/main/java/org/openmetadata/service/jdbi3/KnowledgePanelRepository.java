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

import static org.openmetadata.service.Entity.KNOWLEDGE_PANEL;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.ui.KnowledgePanel;
import org.openmetadata.service.resources.teams.PersonaResource;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public class KnowledgePanelRepository extends EntityRepository<KnowledgePanel> {
  static final String KNOWLEDGE_PANEL_UPDATE_FIELDS = "supportedSizes, configuration";
  static final String KNOWLEDGE_PANEL_PATCH_FIELDS = "supportedSizes, configuration";

  public KnowledgePanelRepository(CollectionDAO dao) {
    super(
        PersonaResource.COLLECTION_PATH,
        KNOWLEDGE_PANEL,
        KnowledgePanel.class,
        dao.knowledgePanelDAO(),
        dao,
        KNOWLEDGE_PANEL_PATCH_FIELDS,
        KNOWLEDGE_PANEL_UPDATE_FIELDS);
    this.quoteFqn = true;
    supportsSearchIndex = false;
  }

  @Override
  public void restorePatchAttributes(KnowledgePanel original, KnowledgePanel updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withName(original.getName()).withId(original.getId());
  }

  @Override
  public KnowledgePanel setFields(KnowledgePanel entity, Fields fields) {
    return entity;
  }

  @Override
  public KnowledgePanel clearFields(KnowledgePanel entity, Fields fields) {
    return entity;
  }

  @Override
  public void prepare(KnowledgePanel entity, boolean update) {}

  @Override
  public void storeEntity(KnowledgePanel knowledgePanel, boolean update) {
    store(knowledgePanel, update);
  }

  @Override
  public void storeRelationships(KnowledgePanel entity) {}

  @Override
  public KnowledgePanelUpdater getUpdater(KnowledgePanel original, KnowledgePanel updated, Operation operation) {
    return new KnowledgePanelUpdater(original, updated, operation);
  }

  /** Handles entity updated from PUT and POST operation. */
  public class KnowledgePanelUpdater extends EntityUpdater {
    public KnowledgePanelUpdater(KnowledgePanel original, KnowledgePanel updated, Operation operation) {
      super(original, updated, operation);
    }
    @Override
    public void entitySpecificUpdate() {
      recordChange("supportedSizes", original.getSupportedSizes(), updated.getSupportedSizes());
      recordChange("configuration", original.getConfiguration(), updated.getConfiguration(), true);
    }
  }
}
