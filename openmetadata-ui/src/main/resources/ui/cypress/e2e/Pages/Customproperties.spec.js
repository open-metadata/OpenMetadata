/*
 *  Copyright 2022 Collate.
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

import {
  addCustomPropertiesForEntity,
  deleteCreatedProperty,
  editCreatedProperty,
  interceptURL,
  verifyResponseStatusCode,
} from '../../common/common';
import { ENTITIES, uuid } from '../../constants/constants';

describe('Custom Properties should work properly', () => {
  beforeEach(() => {
    cy.login();
    interceptURL('GET', '/api/v1/users*', 'settingsPage');
    cy.get('[data-testid="appbar-item-settings"]').should('be.visible').click();
    verifyResponseStatusCode('@settingsPage', 200);
    cy.get('[data-testid="settings-left-panel"]').should('be.visible');
  });

  describe('Add update and delete Integer custom properties', () => {
    Object.values(ENTITIES).forEach((entity) => {
      const propertyName = `entity${entity.name}test${uuid()}`;

      it(`Add Integer custom property for ${entity.name}  Entities`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
          .scrollIntoView()
          .should('be.visible')
          .click();

        verifyResponseStatusCode('@getEntity', 200);

        // Getting the property
        addCustomPropertiesForEntity(
          propertyName,
          entity,
          'integer',
          entity.integerValue,
          entity.entityObj
        );
        // Navigating back to custom properties page
        cy.get('[data-testid="appbar-item-settings"]')
          .should('be.visible')
          .click();
        cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
          .scrollIntoView()
          .should('be.visible')
          .click();

        verifyResponseStatusCode('@getEntity', 200);
      });

      it(`Edit created property for ${entity.name} entity`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
          .scrollIntoView()
          .should('be.visible')
          .click();

        verifyResponseStatusCode('@getEntity', 200);
        editCreatedProperty(propertyName);
      });

      it(`Delete created property for ${entity.name} entity`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
          .scrollIntoView()
          .should('be.visible')
          .click();

        verifyResponseStatusCode('@getEntity', 200);
        deleteCreatedProperty(propertyName);
      });
    });
  });

  describe('Add update and delete String custom properties', () => {
    Object.values(ENTITIES).forEach((entity) => {
      const propertyName = `entity${entity.name}test${uuid()}`;

      it(`Add String custom property for ${entity.name} Entities`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
          .scrollIntoView()
          .should('be.visible')
          .click();

        verifyResponseStatusCode('@getEntity', 200);

        addCustomPropertiesForEntity(
          propertyName,
          entity,
          'string',
          entity.stringValue,
          entity.entityObj
        );

        // Navigating back to custom properties page
        cy.get('[data-testid="appbar-item-settings"]')
          .should('be.visible')
          .click();
        // Selecting the entity
        cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
          .scrollIntoView()
          .should('be.visible')
          .click();

        verifyResponseStatusCode('@getEntity', 200);
      });

      it(`Edit created property for ${entity.name} entity`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
          .scrollIntoView()
          .should('be.visible')
          .click();

        verifyResponseStatusCode('@getEntity', 200);
        editCreatedProperty(propertyName);
      });

      it(`Delete created property for ${entity.name} entity`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
          .scrollIntoView()
          .should('be.visible')
          .click();

        verifyResponseStatusCode('@getEntity', 200);
        deleteCreatedProperty(propertyName);
      });
    });
  });

  describe('Add update and delete Markdown custom properties', () => {
    Object.values(ENTITIES).forEach((entity) => {
      const propertyName = `entity${entity.name}test${uuid()}`;

      it(`Add Markdown custom property for ${entity.name} Entities`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
          .scrollIntoView()
          .should('be.visible')
          .click();

        verifyResponseStatusCode('@getEntity', 200);

        addCustomPropertiesForEntity(
          propertyName,
          entity,
          'markdown',
          entity.markdownValue,
          entity.entityObj
        );
        // Navigating back to custom properties page
        cy.get('[data-testid="appbar-item-settings"]')
          .should('be.visible')
          .click();
        cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
          .scrollIntoView()
          .should('be.visible')
          .click();

        verifyResponseStatusCode('@getEntity', 200);
      });

      it(`Edit created property for ${entity.name} entity`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
          .scrollIntoView()
          .should('be.visible')
          .click();

        verifyResponseStatusCode('@getEntity', 200);
        editCreatedProperty(propertyName);
      });

      it(`Delete created property for ${entity.name} entity`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
          .scrollIntoView()
          .should('be.visible')
          .click();

        verifyResponseStatusCode('@getEntity', 200);
        deleteCreatedProperty(propertyName);
      });
    });
  });
});
