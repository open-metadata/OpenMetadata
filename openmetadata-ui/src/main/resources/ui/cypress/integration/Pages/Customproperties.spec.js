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

import { addCustomPropertiesForEntity, deleteCreatedProperty, editCreatedProperty } from '../../common/common';
import { ENTITIES } from '../../constants/constants';

describe('Custom Properties should work properly', () => {
  beforeEach(() => {
    cy.goToHomePage();
    cy.get('[data-testid="appbar-item-settings"]').should('be.visible').click();
    cy.wait(1000);
  });

  it('Add Integer custom property for all Entities', () => {
    Object.values(ENTITIES).forEach((entity) => {
      //Selecting the entity
      cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
        .scrollIntoView()
        .should('be.visible')
        .click();

      cy.wait(1000);
      
      //Getting the property
      const propertyName = addCustomPropertiesForEntity(
        entity,
        'integer',
        entity.integerValue
      );
      //Navigating back to custom properties page
      cy.get('[data-testid="appbar-item-settings"]')
        .should('be.visible')
        .click();
      cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
        .scrollIntoView()
        .should('be.visible')
        .click();
      cy.wait(1000);

      editCreatedProperty(propertyName);

      deleteCreatedProperty(propertyName);
    });
  });

  it('Add String custom property for all Entities', () => {
    Object.values(ENTITIES).forEach((entity) => {
      //Selecting the entity
      cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
        .scrollIntoView()
        .should('be.visible')
        .click();

      const propertyName = addCustomPropertiesForEntity(
        entity,
        'string',
        entity.stringValue
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
      cy.wait(1000);

      editCreatedProperty(propertyName);

      deleteCreatedProperty(propertyName);
    });
  });

  it('Add Markdown custom property for all Entities', () => {
    Object.values(ENTITIES).forEach((entity) => {
      //Selecting the entity
      cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
        .scrollIntoView()
        .should('be.visible')
        .click();
      const propertyName = addCustomPropertiesForEntity(
        entity,
        'markdown',
        entity.markdownValue
      );
      //Navigating back to custom properties page
      cy.get('[data-testid="appbar-item-settings"]')
        .should('be.visible')
        .click();
      cy.get(`[data-menu-id*="customAttributes.${entity.name}"]`)
        .scrollIntoView()
        .should('be.visible')
        .click();
      cy.wait(1000);

      editCreatedProperty(propertyName);

      deleteCreatedProperty(propertyName);
    });
  });
});
