/*
 *  Copyright 2023 Collate.
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
/* eslint-disable @typescript-eslint/no-empty-function */
import { addOwner } from '../../common/common';

class EntityClass {
  tableName: string;
  token: Cypress.Storable;
  entityDetails: unknown;

  constructor(tableName: string, entityDetails: unknown) {
    this.tableName = tableName;
    this.entityDetails = entityDetails;
  }

  async setToken() {
    await new Promise<void>((res) =>
      cy.getAllLocalStorage().then((data) => {
        const token = Object.values(data)[0].oidcIdToken;

        this.token = token;
        res();
      })
    );
  }

  // Creation

  createEntity() {}

  // Visit entity

  visitEntity() {
    // visitEntityDetailsPage(fqn);
  }

  // Navigate to entity

  // Domain

  assignDomain() {}

  updateDomain() {}

  removeDomain() {}

  // Owner

  assignOwner(ownerName: string, entity: string) {
    addOwner(ownerName, entity);
  }
  updateOwner() {}
  removeOwner() {}
  assignTeamOwner() {}
  updateTeamOwner() {}
  removeTeamOwner() {}

  // Tier

  assignTier() {}
  updateTier() {}
  removeTier() {}

  // Description

  updateDescription() {}

  // Tags

  assignTags() {}
  updateTags() {}
  removeTags() {}

  // Glossary

  assignGlossary() {}
  updateGlossary() {}
  removeGlossary() {}

  // Rename

  renameEntity() {}

  // Delete

  softDeleteEntity() {}
  hardDeleteEntity() {}

  // Announcement

  createAnnouncement() {}
  updateAnnouncement() {}
  removeAnnouncement() {}

  // Inactive Announcement

  createInactiveAnnouncement() {}
  updateInactiveAnnouncement() {}
  removeInactiveAnnouncement() {}

  // Custom property

  createCustomProperty() {}
  updateCustomProperty() {}
  removeCustomProperty() {}
}

export default EntityClass;
