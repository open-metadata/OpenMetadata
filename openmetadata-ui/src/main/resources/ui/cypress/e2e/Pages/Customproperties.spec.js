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

import { addCustomPropertiesForEntity, deleteCreatedProperty, editCreatedProperty, interceptURL, login, verifyResponseStatusCode } from '../../common/common';
import { ENTITIES, LOGIN } from '../../constants/constants';

describe('Custom Properties should work properly', () => {
  before(() => {
    cy.clearLocalStorageSnapshot();
    login(LOGIN.username, LOGIN.password);
    cy.goToHomePage();
    cy.saveLocalStorage('localstorage');
  });
  beforeEach(() => {
    cy.log('Restoring local storage snapshot');
    cy.restoreLocalStorage('localstorage');
    cy.clickOnLogo();
    interceptURL('GET', '/api/v1/users*', 'settingsPage');
    cy.get('[data-testid="appbar-item-settings"]').should('be.visible').click();
    verifyResponseStatusCode('@settingsPage', 200);
    cy.get('[data-testid="settings-left-panel"]').should('be.visible');
  });

  Object.values(ENTITIES).forEach((entity) => {
    it(`Add Integer custom property for ${entity.name}  Entities`, () => {
     cy.getSearchQueryName(entity.name).then((entityName) => {
        
      interceptURL(
        'GET',
        `/api/v1/metadata/types/name/${entity.name}*`,
        'getEntity'
      );

      //Selecting the entity
      cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
        .scrollIntoView()
        .should('be.visible')
        .click();

      verifyResponseStatusCode('@getEntity', 200);

      //Getting the property
      const propertyName = addCustomPropertiesForEntity(
        entity,
        'integer',
        entity.integerValue,
        entity.entityObj,
        entityName
      );
      //Navigating back to custom properties page
      cy.get('[data-testid="appbar-item-settings"]')
        .should('be.visible')
        .click();
      cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
        .scrollIntoView()
        .should('be.visible')
        .click();

      verifyResponseStatusCode('@getEntity', 200);

      editCreatedProperty(propertyName);

      deleteCreatedProperty(propertyName);
    });

})
  });
  
  Object.values(ENTITIES).forEach((entity) => {
    it(`Add String custom property for ${entity.name} Entities`, () => {
      interceptURL(
        'GET',
        `/api/v1/metadata/types/name/${entity.name}*`,
        'getEntity'
      );

      //Selecting the entity
      cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
        .scrollIntoView()
        .should('be.visible')
        .click();

      verifyResponseStatusCode('@getEntity', 200);

      const propertyName = addCustomPropertiesForEntity(
        entity,
        'string',
        entity.stringValue,
        entity.entityObj
      );

      //Navigating back to custom properties page
      cy.get('[data-testid="appbar-item-settings"]')
        .should('be.visible')
        .click();
      //Selecting the entity
      cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
        .scrollIntoView()
        .should('be.visible')
        .click();

      verifyResponseStatusCode('@getEntity', 200);

      editCreatedProperty(propertyName);

      deleteCreatedProperty(propertyName);
    });
  });

  Object.values(ENTITIES).forEach((entity) => {
    it(`Add Markdown custom property for ${entity.name} Entities`, () => {
      interceptURL(
        'GET',
        `/api/v1/metadata/types/name/${entity.name}*`,
        'getEntity'
      );

      //Selecting the entity
      cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
        .scrollIntoView()
        .should('be.visible')
        .click();

      verifyResponseStatusCode('@getEntity', 200);

      const propertyName = addCustomPropertiesForEntity(
        entity,
        'markdown',
        entity.markdownValue,
        entity.entityObj
      );
      //Navigating back to custom properties page
      cy.get('[data-testid="appbar-item-settings"]')
        .should('be.visible')
        .click();
      cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
        .scrollIntoView()
        .should('be.visible')
        .click();

      verifyResponseStatusCode('@getEntity', 200);

      editCreatedProperty(propertyName);

      deleteCreatedProperty(propertyName);
    });
  });
});
