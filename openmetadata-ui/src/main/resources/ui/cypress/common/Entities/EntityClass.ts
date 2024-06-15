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

import { uuid } from '../../constants/constants';
import { CustomPropertySupportedEntityList } from '../../constants/CustomProperty.constant';
import { EntityType, ENTITY_PATH } from '../../constants/Entity.interface';
import {
  createAnnouncement as createAnnouncementUtil,
  createInactiveAnnouncement as createInactiveAnnouncementUtil,
  deleteAnnouncement,
  replyAnnouncementUtil,
} from '../Utils/Annoucement';
import {
  createCustomPropertyForEntity,
  CustomProperty,
  deleteCustomProperties,
  setValueForProperty,
  validateValueForProperty,
} from '../Utils/CustomProperty';
import { addDomainToEntity, removeDomainFromEntity } from '../Utils/Domain';
import {
  createEntityViaREST,
  deleteEntity,
  deleteEntityViaREST,
  followEntity,
  hardDeleteEntity as hardDeleteEntityUtil,
  restoreEntity as restoreEntityUtil,
  unfollowEntity,
  updateDescriptioForEntity,
  updateDisplayNameForEntity,
  validateFollowedEntityToWidget,
} from '../Utils/Entity';
import {
  assignGlossaryTerm,
  removeGlossaryTerm,
  updateGlossaryTerm,
} from '../Utils/Glossary';
import { getToken } from '../Utils/LocalStorage';
import {
  addOwner,
  addTeamAsOwner,
  removeOwner,
  removeTeamAsOwner,
  updateOwner,
  updateTeamAsOwner,
  validateOwnerAndTeamCounts,
} from '../Utils/Owner';
import { assignTags, removeTags, updateTags } from '../Utils/Tags';
import { addTier, removeTier, updateTier } from '../Utils/Tier';
import { downVoteEntity, upVoteEntity } from '../Utils/Voting';

const description =
  // eslint-disable-next-line max-len
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus varius quam eu mi ullamcorper, in porttitor magna mollis. Duis a tellus aliquet nunc commodo bibendum. Donec euismod maximus porttitor. Aenean quis lacus ultrices, tincidunt erat ac, dapibus felis.';

export const domainDetails1 = {
  name: `cypress-domain-${uuid()}`,
  displayName: `Cypress%Domain.${uuid()}`,
  description: 'Cypress domain description',
  domainType: 'Aggregate',
  experts: [],
  style: {},
};

export const domainDetails2 = {
  name: `cypress-domain-${uuid()}`,
  displayName: `Cypress%Domain.${uuid()}`,
  description: 'Cypress domain description',
  domainType: 'Aggregate',
  experts: [],
  style: {},
};

export const glossaryDetails1 = {
  name: `Cypress%General ${uuid()}`,
  displayName: `Cypress % General ${uuid()}`,
  description:
    'Glossary terms that describe general conceptual terms. **Note that these conceptual terms are used for automatically labeling the data.**',
  reviewers: [],
  tags: [],
  mutuallyExclusive: false,
};

export const glossaryDetails2 = {
  name: `Cypress%Person ${uuid()}`,
  displayName: `Cypress % Person ${uuid()}`,
  description:
    // eslint-disable-next-line max-len
    'Glossary related to describing **conceptual** terms related to a Person. These terms are used to label data assets to describe the user data in those assets. Example - a table column can be labeled with Person.PhoneNumber tag. The associated PII and PersonalData tags are automatically applied.',
  reviewers: [],
  tags: [],
  mutuallyExclusive: false,
};

export const glossaryTermDetails1 = {
  name: `CypressBankNumber-${uuid()}`,
  displayName: 'Cypress BankNumber',
  description: 'A bank account number.',
  reviewers: [],
  relatedTerms: [],
  synonyms: [],
  mutuallyExclusive: false,
  tags: [],
  style: {},
  glossary: glossaryDetails1.name,
};

export const glossaryTermDetails2 = {
  name: 'CypressAddress',
  displayName: 'Cypress Address',
  description: 'Address of a Person.',
  reviewers: [],
  relatedTerms: [],
  synonyms: [],
  mutuallyExclusive: false,
  tags: [],
  style: {},
  glossary: glossaryDetails2.name,
};

class EntityClass {
  entityName: string;
  token: Cypress.Storable;
  entityDetails: unknown;
  endPoint: EntityType;
  protected name: string;

  customPropertyValue: Record<
    string,
    { value: string; newValue: string; property: CustomProperty }
  >;

  constructor(
    entityName: string,
    entityDetails: unknown,
    endPoint: EntityType
  ) {
    this.entityName = entityName;
    this.entityDetails = entityDetails;
    this.endPoint = endPoint;
  }

  public getName() {
    return this.name;
  }

  async setToken() {
    await new Promise<void>((res) =>
      cy.getAllLocalStorage().then((data) => {
        const token = getToken(data);

        this.token = token;
        res();
      })
    );
  }

  // Prepare for tests
  prepareForTests() {
    this.createEntity();

    // Create custom property only for supported entities
    if (CustomPropertySupportedEntityList.includes(this.endPoint)) {
      createCustomPropertyForEntity(this.endPoint).then((data) => {
        this.customPropertyValue = data as unknown as Record<
          string,
          {
            value: string;
            newValue: string;
            property: CustomProperty;
          }
        >;
      });
    }
  }

  static preRequisitesForTests() {
    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);

      // assign DevOps team to user

      //   cy.get('[data-testid="dropdown-profile"]').click();
      //   cy.get('[data-testid="user-name"]').click();
      //   // edit teams
      //   cy.get('.ant-collapse-expand-icon > .anticon > svg').click();
      //   editTeams('DevOps');

      // Create domain

      createEntityViaREST({
        body: domainDetails1,
        endPoint: EntityType.Domain,
        token,
      });

      createEntityViaREST({
        body: domainDetails2,
        endPoint: EntityType.Domain,
        token,
      });

      // Create glossary

      createEntityViaREST({
        body: glossaryDetails1,
        endPoint: EntityType.Glossary,
        token,
      });

      createEntityViaREST({
        body: glossaryDetails2,
        endPoint: EntityType.Glossary,
        token,
      });

      // Create glossary term

      createEntityViaREST({
        body: glossaryTermDetails1,
        endPoint: EntityType.GlossaryTerm,
        token,
      });

      createEntityViaREST({
        body: glossaryTermDetails2,
        endPoint: EntityType.GlossaryTerm,
        token,
      });
    });
  }

  cleanup() {
    // Delete custom property only for supported entities
    if (CustomPropertySupportedEntityList.includes(this.endPoint)) {
      cy.getAllLocalStorage().then((data) => {
        const token = getToken(data);
        cy.request({
          method: 'GET',
          url: `/api/v1/metadata/types/name/${ENTITY_PATH[this.endPoint]}`,
          headers: { Authorization: `Bearer ${token}` },
        }).then(({ body }) => {
          deleteCustomProperties(body.id, token);
        });
      });
    }
  }

  static postRequisitesForTests() {
    cy.getAllLocalStorage().then((data) => {
      const token = getToken(data);

      // Remove devops as team
      //   cy.get('[data-testid="dropdown-profile"]').click();
      //   cy.get('[data-testid="user-name"]').click();
      //   // edit teams
      //   cy.get('.ant-collapse-expand-icon > .anticon > svg').scrollIntoView();
      //   cy.get('.ant-collapse-expand-icon > .anticon > svg').click();
      //   editTeams('');

      // Domain 1 to test
      deleteEntityViaREST({
        entityName: domainDetails1.name,
        endPoint: EntityType.Domain,
        token,
      });
      // Domain 2 to test
      deleteEntityViaREST({
        entityName: domainDetails2.name,
        endPoint: EntityType.Domain,
        token,
      });
      // Glossary 1 to test
      deleteEntityViaREST({
        entityName: `${encodeURIComponent(glossaryDetails1.name)}.${
          glossaryTermDetails1.name
        }`,
        endPoint: EntityType.GlossaryTerm,
        token,
      });
      // Glossary 2 to test
      deleteEntityViaREST({
        entityName: `${encodeURIComponent(glossaryDetails2.name)}.${
          glossaryTermDetails2.name
        }`,
        endPoint: EntityType.GlossaryTerm,
        token,
      });
      // Glossary 2 to test
      deleteEntityViaREST({
        entityName: encodeURIComponent(glossaryDetails1.name),
        endPoint: EntityType.Glossary,
        token,
      });
      deleteEntityViaREST({
        entityName: encodeURIComponent(glossaryDetails2.name),
        endPoint: EntityType.Glossary,
        token,
      });
    });
  }

  // Creation

  createEntity() {
    // Override for entity creation
  }

  // Visit entity

  visitEntity() {
    // Override for entity visit
  }

  // Navigate to entity

  // Domain

  assignDomain() {
    addDomainToEntity(domainDetails1.displayName);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  validateDomainVersionForEntity() {}

  updateDomain() {
    addDomainToEntity(domainDetails2.displayName);
  }

  removeDomain() {
    removeDomainFromEntity(domainDetails2.displayName);
  }

  // Owner

  userOwnerFlow(ownerName: string, newOwnerName: string) {
    validateOwnerAndTeamCounts();
    addOwner(ownerName);
    updateOwner(newOwnerName);
    removeOwner(newOwnerName);
  }

  // Team as Owner
  teamOwnerFlow(teamName: string, newTeamName: string) {
    addTeamAsOwner(teamName);
    // validateOwnedEntityToWidget(this.entityName, true);
    updateTeamAsOwner(newTeamName);
    // validateOwnedEntityToWidget(this.entityName, false);
    removeTeamAsOwner(newTeamName);
    // validateOwnedEntityToWidget(this.entityName, false);
  }

  // Tier

  tierFlow(tier: string, newTier: string) {
    addTier(tier);
    updateTier(newTier);
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
    updateTags('PII.None', this.endPoint);
  }
  removeTags() {
    removeTags(['PersonalData.Personal', 'PII.None'], this.endPoint);
  }

  // Glossary

  assignGlossary() {
    assignGlossaryTerm(
      `${glossaryDetails1.name}.${glossaryTermDetails1.name}`,
      glossaryTermDetails1.name,
      this.endPoint
    );
  }
  updateGlossary() {
    updateGlossaryTerm(
      `${glossaryDetails2.name}.${glossaryTermDetails2.name}`,
      glossaryTermDetails2.name,
      this.endPoint
    );
  }
  removeGlossary() {
    removeGlossaryTerm(
      [
        `${glossaryDetails1.name}.${glossaryTermDetails1.name}`,
        `${glossaryDetails2.name}.${glossaryTermDetails2.name}`,
      ],
      this.endPoint
    );
  }

  // Voting

  upVote() {
    upVoteEntity({ endPoint: this.endPoint });
  }

  downVote() {
    downVoteEntity({ endPoint: this.endPoint });
  }

  // Rename

  renameEntity() {
    updateDisplayNameForEntity(`Cypress ${this.name} updated`, this.endPoint);
  }

  // Delete

  softDeleteEntity() {
    deleteEntity(
      this.entityName,
      this.endPoint,
      `Cypress ${this.name} updated`
    );
  }

  restoreEntity() {
    restoreEntityUtil();
  }

  hardDeleteEntity() {
    hardDeleteEntityUtil(`Cypress ${this.name} updated`, this.endPoint);
  }

  // Announcement

  createAnnouncement() {
    createAnnouncementUtil(
      {
        title: 'Cypress announcement',
        description: 'Cypress announcement description',
      },
      this.entityName,
      this.name
    );
  }

  replyAnnouncement() {
    replyAnnouncementUtil();
  }

  removeAnnouncement() {
    deleteAnnouncement();
  }

  // Inactive Announcement

  createInactiveAnnouncement() {
    createInactiveAnnouncementUtil({
      title: 'Inactive Cypress announcement',
      description: 'Inactive Cypress announcement description',
    });
  }

  removeInactiveAnnouncement() {
    deleteAnnouncement();
  }

  followUnfollowEntity() {
    followEntity(this.endPoint);
    validateFollowedEntityToWidget(this.entityName, true);
    this.visitEntity();
    unfollowEntity(this.endPoint);
    validateFollowedEntityToWidget(this.entityName, false);
  }

  // Custom property

  setCustomProperty(propertydetails: CustomProperty, value: string) {
    setValueForProperty(
      propertydetails.name,
      value,
      propertydetails.propertyType.name
    );
    validateValueForProperty(
      propertydetails.name,
      value,
      propertydetails.propertyType.name
    );
  }

  updateCustomProperty(propertydetails: CustomProperty, value: string) {
    setValueForProperty(
      propertydetails.name,
      value,
      propertydetails.propertyType.name
    );
    validateValueForProperty(
      propertydetails.name,
      value,
      propertydetails.propertyType.name
    );
  }
}

export default EntityClass;
