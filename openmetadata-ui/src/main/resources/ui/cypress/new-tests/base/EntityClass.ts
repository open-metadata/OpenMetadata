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

import {
  createAnnouncement as createAnnouncementUtil,
  createInactiveAnnouncement as createInactiveAnnouncementUtil,
  deleteAnnoucement,
} from '../../common/Utils/Annoucement';
import {
  addDomainToEntity,
  removeDomainFromEntity,
} from '../../common/Utils/Domain';
import {
  deleteEntity,
  hardDeleteEntity as hardDeleteEntityUtil,
  restoreEntity as restoreEntityUtil,
  updateDescriptioForEntity,
  updateDisplayNameForEntity,
} from '../../common/Utils/Entity';
import {
  assignGlossaryTerm,
  removeGlossaryTerm,
  udpateGlossaryTerm,
} from '../../common/Utils/Glossary';
import {
  addOwner,
  addRemoveAsOwner,
  addTeamAsOwner,
  removeOwner,
} from '../../common/Utils/Owner';
import { assignTags, removeTags, udpateTags } from '../../common/Utils/Tags';
import { addTier, removeTier } from '../../common/Utils/Tier';

export enum EntityType {
  Table = 'tables',
  Topic = 'topics',
  Dashboard = 'dashboards',
  Pipeline = 'pipelines',
  Container = 'containers',
  MlModel = 'mlmodels',
  Domain = 'domains',
}

const description =
  // eslint-disable-next-line max-len
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus varius quam eu mi ullamcorper, in porttitor magna mollis. Duis a tellus aliquet nunc commodo bibendum. Donec euismod maximus porttitor. Aenean quis lacus ultrices, tincidunt erat ac, dapibus felis.';

class EntityClass {
  entityName: string;
  token: Cypress.Storable;
  entityDetails: unknown;
  endPoint: EntityType;
  protected name: string;

  constructor(
    entityName: string,
    entityDetails: unknown,
    endPoint: EntityType
  ) {
    this.entityName = entityName;
    this.entityDetails = entityDetails;
    this.endPoint = endPoint;
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

  visitEntity() {}

  // Navigate to entity

  // Domain

  assignDomain(domainName: string) {
    addDomainToEntity(domainName);
  }

  updateDomain(domainName: string) {
    addDomainToEntity(domainName);
  }

  removeDomain(domainName: string) {
    removeDomainFromEntity(domainName);
  }

  // Owner

  assignOwner(ownerName: string) {
    addOwner(ownerName);
  }
  updateOwner(ownerName: string) {
    addOwner(ownerName);
  }
  removeOwner(ownerName: string) {
    removeOwner(ownerName);
  }

  // Team as Owner
  assignTeamOwner(teamName: string) {
    addTeamAsOwner(teamName);
  }
  updateTeamOwner(teamName: string) {
    addTeamAsOwner(teamName);
  }
  removeTeamOwner(teamName: string) {
    addRemoveAsOwner(teamName);
  }

  // Tier

  assignTier(tier: string) {
    addTier(tier);
  }
  updateTier(tier: string) {
    addTier(tier);
  }
  removeTier() {
    removeTier();
  }

  // Description

  updateDescription() {
    updateDescriptioForEntity(description, this.endPoint);
  }

  // Tags

  assignTags() {
    assignTags('PersonalData.Personal', this.endPoint);
  }
  updateTags() {
    udpateTags('PII.None', this.endPoint);
  }
  removeTags() {
    removeTags(['PersonalData.Personal', 'PII.None'], this.endPoint);
  }

  // Glossary

  assignGlossary() {
    assignGlossaryTerm('business glossary.Location', this.endPoint);
  }
  updateGlossary() {
    udpateGlossaryTerm('business glossary.DateTime', this.endPoint);
  }
  removeGlossary() {
    removeGlossaryTerm(
      ['business glossary.Location', 'business glossary.DateTime'],
      this.endPoint
    );
  }

  // Rename

  renameEntity() {
    updateDisplayNameForEntity(`Cypress ${this.name} updated`, this.endPoint);
  }

  // Delete

  softDeleteEntity() {
    deleteEntity(this.entityName, this.endPoint);
  }

  restoreEntity() {
    restoreEntityUtil(this.entityName);
  }

  hardDeleteEntity() {
    hardDeleteEntityUtil(this.entityName, this.endPoint);
  }

  // Announcement

  createAnnouncement() {
    createAnnouncementUtil({
      title: 'Cypress annocement',
      description: 'Cypress annocement description',
    });
  }

  removeAnnouncement() {
    deleteAnnoucement();
  }

  // Inactive Announcement

  createInactiveAnnouncement() {
    createInactiveAnnouncementUtil({
      title: 'Inactive Cypress annocement',
      description: 'Inactive Cypress annocement description',
    });
  }

  removeInactiveAnnouncement() {
    deleteAnnoucement();
  }

  // Custom property

  createCustomProperty() {}
  updateCustomProperty() {}
  removeCustomProperty() {}
}

export default EntityClass;
