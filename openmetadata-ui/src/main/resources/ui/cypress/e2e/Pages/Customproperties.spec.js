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

import _ from 'lodash';
import {
  addCustomPropertiesForEntity,
  deleteCreatedProperty,
  descriptionBox,
  editCreatedProperty,
  interceptURL,
  verifyResponseStatusCode,
} from '../../common/common';
import {
  CustomPropertyType,
  deleteCustomPropertyForEntity,
  generateCustomProperty,
  setValueForProperty,
  validateValueForProperty,
} from '../../common/Utils/CustomProperty';
import { visitEntityDetailsPage } from '../../common/Utils/Entity';
import {
  ENTITIES,
  INVALID_NAMES,
  NAME_MAX_LENGTH_VALIDATION_ERROR,
  NAME_VALIDATION_ERROR,
  NEW_GLOSSARY,
  NEW_GLOSSARY_TERMS,
  uuid,
} from '../../constants/constants';
import { SidebarItem } from '../../constants/Entity.interface';
import { GlobalSettingOptions } from '../../constants/settings.constant';

describe('Custom Properties should work properly', () => {
  beforeEach(() => {
    cy.login();
  });

  describe('Add update and delete Integer custom properties', () => {
    Object.values(ENTITIES).forEach((entity) => {
      const propertyName = `addcyentity${entity.name}test${uuid()}`;

      it(`Add Integer custom property for ${entity.name}  Entities`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);

        // Getting the property
        addCustomPropertiesForEntity(
          propertyName,
          entity,
          'Integer',
          entity.integerValue,
          entity.entityObj
        );

        // Navigating back to custom properties page
        cy.settingClick(entity.entityApiType, true);
        verifyResponseStatusCode('@getEntity', 200);
      });

      it(`Edit created property for ${entity.name} entity`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.settingClick(entity.entityApiType, true);

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
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);
        deleteCreatedProperty(propertyName);
      });
    });
  });

  describe('Add update and delete String custom properties', () => {
    Object.values(ENTITIES).forEach((entity) => {
      const propertyName = `addcyentity${entity.name}test${uuid()}`;

      it(`Add String custom property for ${entity.name} Entities`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);

        addCustomPropertiesForEntity(
          propertyName,
          entity,
          'String',
          entity.stringValue,
          entity.entityObj
        );

        // Navigating back to custom properties page
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);
      });

      it(`Edit created property for ${entity.name} entity`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.settingClick(entity.entityApiType, true);

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
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);
        deleteCreatedProperty(propertyName);
      });
    });
  });

  describe('Add update and delete Markdown custom properties', () => {
    Object.values(ENTITIES).forEach((entity) => {
      const propertyName = `addcyentity${entity.name}test${uuid()}`;

      it(`Add Markdown custom property for ${entity.name} Entities`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);

        addCustomPropertiesForEntity(
          propertyName,
          entity,
          'Markdown',
          entity.markdownValue,
          entity.entityObj
        );

        // Navigating back to custom properties page
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);
      });

      it(`Edit created property for ${entity.name} entity`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.settingClick(entity.entityApiType, true);

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
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);
        deleteCreatedProperty(propertyName);
      });
    });
  });

  describe('Create custom properties for glossary', () => {
    const userName = `test_dataconsumer${uuid()}`;

    const CREDENTIALS = {
      firstName: 'Cypress',
      lastName: 'UserDC',
      email: `${userName}@openmetadata.org`,
      password: 'User@OMD123',
      username: 'CypressUserDC',
    };

    const glossaryTerm = {
      name: 'glossaryTerm',
      description: 'This is Glossary Term custom property',
      integerValue: '45',
      stringValue: 'This is string property',
      markdownValue: 'This is markdown value',
      entityApiType: 'glossaryTerm',
    };
    const validateForm = () => {
      // error messages
      cy.get('#name_help')
        .scrollIntoView()
        .should('be.visible')
        .contains('Name is required');
      cy.get('#description_help')
        .should('be.visible')
        .contains('Description is required');

      // max length validation
      cy.get('[data-testid="name"]')
        .scrollIntoView()
        .should('be.visible')
        .type(INVALID_NAMES.MAX_LENGTH);
      cy.get('#name_help')
        .should('be.visible')
        .contains(NAME_MAX_LENGTH_VALIDATION_ERROR);

      // with special char validation
      cy.get('[data-testid="name"]')
        .should('be.visible')
        .clear()
        .type(INVALID_NAMES.WITH_SPECIAL_CHARS);
      cy.get('#name_help').should('be.visible').contains(NAME_VALIDATION_ERROR);
    };
    const createGlossary = (glossaryData) => {
      // Intercept API calls
      interceptURL('POST', '/api/v1/glossaries', 'createGlossary');
      interceptURL(
        'GET',
        '/api/v1/search/query?q=*disabled:false&index=tag_search_index&from=0&size=10&query_filter=%7B%7D',
        'fetchTags'
      );

      // Click on the "Add Glossary" button
      cy.get('[data-testid="add-glossary"]').click();

      // Validate redirection to the add glossary page
      cy.get('[data-testid="form-heading"]')
        .contains('Add Glossary')
        .should('be.visible');

      // Perform glossary creation steps
      cy.get('[data-testid="save-glossary"]')
        .scrollIntoView()
        .should('be.visible')
        .click();

      validateForm();

      cy.get('[data-testid="name"]')
        .scrollIntoView()
        .should('be.visible')
        .clear()
        .type(glossaryData.name);

      cy.get(descriptionBox)
        .scrollIntoView()
        .should('be.visible')
        .type(glossaryData.description);

      if (glossaryData.isMutually) {
        cy.get('[data-testid="mutually-exclusive-button"]')
          .scrollIntoView()
          .click();
      }

      if (glossaryData.tag) {
        // Add tag
        cy.get('[data-testid="tag-selector"] .ant-select-selection-overflow')
          .scrollIntoView()
          .type(glossaryData.tag);

        verifyResponseStatusCode('@fetchTags', 200);
        cy.get(`[data-testid="tag-${glossaryData.tag}"]`).click();
        cy.get('[data-testid="right-panel"]').click();
      }

      if (glossaryData.addReviewer) {
        // Add reviewer
        cy.get('[data-testid="add-reviewers"]').scrollIntoView().click();
        cy.get('[data-testid="searchbar"]').type(CREDENTIALS.username);
        cy.get(`[title="${CREDENTIALS.username}"]`)
          .scrollIntoView()
          .should('be.visible')
          .click();
        cy.get('[data-testid="selectable-list-update-btn"]')
          .should('exist')
          .and('be.visible')
          .click();
      }

      cy.get('[data-testid="save-glossary"]')
        .scrollIntoView()
        .should('be.visible')
        .click();

      cy.wait('@createGlossary').then(({ request }) => {
        expect(request.body.name).equals(glossaryData.name);
        expect(request.body.description).equals(glossaryData.description);
      });

      cy.url().should('include', '/glossary/');
    };
    const propertyName = `addcyentity${glossaryTerm.name}test${uuid()}`;
    const properties = Object.values(CustomPropertyType).join(', ');
    const customPropertyValue = {
      Integer: {
        value: '123',
        newValue: '456',
        property: generateCustomProperty(CustomPropertyType.INTEGER),
      },
      String: {
        value: '123',
        newValue: '456',
        property: generateCustomProperty(CustomPropertyType.STRING),
      },
      Markdown: {
        value: '**Bold statement**',
        newValue: '__Italic statement__',
        property: generateCustomProperty(CustomPropertyType.MARKDOWN),
      },
    };
    const fillGlossaryTermDetails = (term, glossary, isMutually = false) => {
      cy.get('[data-testid="add-new-tag-button-header"]').click();

      cy.contains('Add Glossary Term').should('be.visible');

      // validation should work
      cy.get('[data-testid="save-glossary-term"]')
        .scrollIntoView()
        .should('be.visible')
        .click();

      validateForm();

      cy.get('[data-testid="name"]')
        .scrollIntoView()
        .should('be.visible')
        .clear()
        .type(term.name);
      cy.get(descriptionBox)
        .scrollIntoView()
        .should('be.visible')
        .type(term.description);

      const synonyms = term.synonyms.split(',');
      cy.get('[data-testid="synonyms"]')
        .scrollIntoView()
        .should('be.visible')
        .type(synonyms.join('{enter}'));
      if (isMutually) {
        cy.get('[data-testid="mutually-exclusive-button"]')
          .scrollIntoView()
          .should('exist')
          .should('be.visible')
          .click();
      }
      cy.get('[data-testid="add-reference"]')
        .scrollIntoView()
        .should('be.visible')
        .click();

      cy.get('#name-0').scrollIntoView().should('be.visible').type('test');
      cy.get('#url-0')
        .scrollIntoView()
        .should('be.visible')
        .type('https://test.com');

      if (term.icon) {
        cy.get('[data-testid="icon-url"]').scrollIntoView().type(term.icon);
      }
      if (term.color) {
        cy.get('[data-testid="color-input"]').scrollIntoView().type(term.color);
      }

      // check for parent glossary reviewer
      if (glossary.name === NEW_GLOSSARY.name) {
        cy.get('[data-testid="user-tag"]')
          .contains(CREDENTIALS.username)
          .should('be.visible');
      }
    };
    const createGlossaryTerm = (term, glossary, status, isMutually = false) => {
      fillGlossaryTermDetails(term, glossary, isMutually);

      interceptURL('POST', '/api/v1/glossaryTerms', 'createGlossaryTerms');
      cy.get('[data-testid="save-glossary-term"]')
        .scrollIntoView()
        .should('be.visible')
        .click();

      verifyResponseStatusCode('@createGlossaryTerms', 201);

      cy.get(
        `[data-row-key="${Cypress.$.escapeSelector(term.fullyQualifiedName)}"]`
      )
        .scrollIntoView()
        .should('be.visible')
        .contains(term.name);

      cy.get(
        `[data-testid="${Cypress.$.escapeSelector(
          term.fullyQualifiedName
        )}-status"]`
      )
        .should('be.visible')
        .contains(status);
    };

    it('test custom properties in advanced search modal', () => {
      cy.settingClick(glossaryTerm.entityApiType, true);

      addCustomPropertiesForEntity(
        propertyName,
        glossaryTerm,
        'Integer',
        '45',
        null
      );

      // Navigating to explore page
      cy.sidebarClick(SidebarItem.EXPLORE);
      interceptURL(
        'GET',
        `/api/v1/metadata/types/name/glossaryTerm*`,
        'getEntity'
      );
      cy.get('[data-testid="glossaries-tab"]').click();

      cy.get('[data-testid="advance-search-button"]').click();
      verifyResponseStatusCode('@getEntity', 200);

      // Click on field dropdown
      cy.get('.rule--field > .ant-select > .ant-select-selector').eq(0).click();

      // Select custom property fields
      cy.get(`[title="Custom Properties"]`).eq(0).click();

      // Click on field dropdown
      cy.get('.rule--field > .ant-select > .ant-select-selector').eq(0).click();

      // Verify field exists
      cy.get(`[title="${propertyName}"]`).should('be.visible');
    });

    it(`Delete created property for glossary term entity`, () => {
      interceptURL(
        'GET',
        `/api/v1/metadata/types/name/${glossaryTerm.name}*`,
        'getEntity'
      );

      // Selecting the entity
      cy.settingClick(glossaryTerm.entityApiType, true);

      verifyResponseStatusCode('@getEntity', 200);
      deleteCreatedProperty(propertyName);
    });

    it(`Set ${properties} Custom Property `, () => {
      interceptURL('GET', '/api/v1/glossaryTerms*', 'getGlossaryTerms');
      interceptURL('GET', '/api/v1/glossaries?fields=*', 'fetchGlossaries');
      cy.sidebarClick(SidebarItem.GLOSSARY);
      createGlossary(NEW_GLOSSARY);
      createGlossaryTerm(
        NEW_GLOSSARY_TERMS.term_1,
        NEW_GLOSSARY,
        'Draft',
        true
      );

      cy.settingClick(glossaryTerm.entityApiType, true);
      Object.values(CustomPropertyType).forEach((type) => {
        addCustomPropertiesForEntity(
          _.lowerCase(type),
          glossaryTerm,
          type,
          `${type}-(${uuid()})`,
          null
        );
        cy.settingClick(glossaryTerm.entityApiType, true);
      });
      visitEntityDetailsPage({
        term: NEW_GLOSSARY_TERMS.term_1.name,
        serviceName: NEW_GLOSSARY_TERMS.term_1.fullyQualifiedName,
        entity: 'glossaryTerms',
        dataTestId: 'Cypress Glossary-CypressPurchase',
      });

      // set custom property value
      Object.values(CustomPropertyType).forEach((type) => {
        setValueForProperty(_.lowerCase(type), customPropertyValue[type].value);
        validateValueForProperty(
          _.lowerCase(type),
          customPropertyValue[type].value
        );
      });
      // update custom property value
      Object.values(CustomPropertyType).forEach((type) => {
        setValueForProperty(
          _.lowerCase(type),
          customPropertyValue[type].newValue
        );
        validateValueForProperty(
          _.lowerCase(type),
          customPropertyValue[type].newValue
        );
      });

      // delete custom properties
      Object.values(CustomPropertyType).forEach((type) => {
        deleteCustomPropertyForEntity(
          customPropertyValue[type],
          glossaryTerm.entityApiType
        );
      });
      cy.settingClick(GlobalSettingOptions.GLOSSARY_TERM, true);

      verifyResponseStatusCode('@getEntity', 200);
      deleteCreatedProperty(NEW_GLOSSARY.name);
    });
  });
});
