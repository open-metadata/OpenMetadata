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

import { lowerCase } from 'lodash';
import {
  addCustomPropertiesForEntity,
  deleteCreatedProperty,
  descriptionBox,
  editCreatedProperty,
  interceptURL,
  verifyResponseStatusCode,
} from '../../common/common';
import { deleteGlossary } from '../../common/GlossaryUtils';
import {
  customPropertiesArray,
  CustomPropertyType,
  deleteCustomProperties,
  deleteCustomPropertyForEntity,
  generateCustomProperty,
  setValueForProperty,
  validateValueForProperty,
  verifyCustomPropertyRows,
} from '../../common/Utils/CustomProperty';
import {
  createEntityTableViaREST,
  visitEntityDetailsPage,
} from '../../common/Utils/Entity';
import {
  DATA_ASSETS,
  ENTITIES,
  INVALID_NAMES,
  NAME_MAX_LENGTH_VALIDATION_ERROR,
  NAME_VALIDATION_ERROR,
  NEW_GLOSSARY,
  NEW_GLOSSARY_TERMS,
  uuid,
} from '../../constants/constants';
import { SidebarItem } from '../../constants/Entity.interface';
import { DATABASE_SERVICE } from '../../constants/EntityConstant';

const CREDENTIALS = {
  name: 'aaron_johnson0',
  displayName: 'Aaron Johnson',
};

const glossaryTerm = {
  name: 'glossaryTerm',
  description: 'This is Glossary Term custom property',
  integerValue: '45',
  stringValue: 'This is string property',
  markdownValue: 'This is markdown value',
  entityApiType: 'glossaryTerm',
};

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
    cy.get('[data-testid="searchbar"]').type(CREDENTIALS.displayName);
    cy.get(`[title="${CREDENTIALS.displayName}"]`)
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

  if (glossary.name === NEW_GLOSSARY.name) {
    cy.get(`[data-testid="${NEW_GLOSSARY_TERMS.term_1.name}"]`)
      .scrollIntoView()
      .click();

    cy.get('[data-testid="glossary-reviewer-name"]')
      .scrollIntoView()
      .contains(CREDENTIALS.displayName)
      .should('be.visible');
  }
};

describe('Custom Properties should work properly', { tags: 'Settings' }, () => {
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

  describe('Add update and delete Enum custom properties', () => {
    Object.values(ENTITIES).forEach((entity) => {
      const propertyName = `addcyentity${entity.name}test${uuid()}`;

      it(`Add Enum custom property for ${entity.name} Entities`, () => {
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
          'Enum',
          entity.enumConfig,
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
        editCreatedProperty(propertyName, 'Enum');
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

  describe('Custom properties for glossary and glossary terms', () => {
    const propertyName = `addcyentity${glossaryTerm.name}test${uuid()}`;
    const properties = Object.values(CustomPropertyType).join(', ');

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
      cy.get(
        `[data-testid=${Cypress.$.escapeSelector('glossary terms-tab')}]`
      ).click();

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

    it(`Add update and delete ${properties} custom properties for glossary term `, () => {
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
          lowerCase(type),
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
        setValueForProperty(lowerCase(type), customPropertyValue[type].value);
        validateValueForProperty(
          lowerCase(type),
          customPropertyValue[type].value
        );
      });

      // update custom property value
      Object.values(CustomPropertyType).forEach((type) => {
        setValueForProperty(
          lowerCase(type),
          customPropertyValue[type].newValue
        );
        validateValueForProperty(
          lowerCase(type),
          customPropertyValue[type].newValue
        );
      });

      // delete custom properties
      Object.values(CustomPropertyType).forEach((customPropertyType) => {
        const type = glossaryTerm.entityApiType;
        const property = customPropertyValue[customPropertyType].property ?? {};

        deleteCustomPropertyForEntity({
          property: { ...property, name: lowerCase(customPropertyType) },
          type,
        });
      });

      // delete glossary and glossary term
      cy.sidebarClick(SidebarItem.GLOSSARY);
      deleteGlossary(NEW_GLOSSARY.name);
    });
  });

  describe('Verify custom properties in right panel and custom properties tab', () => {
    let tableSchemaId = '';
    let token = '';
    before(() => {
      cy.login();

      cy.getAllLocalStorage().then((data) => {
        token = Object.values(data)[0].oidcIdToken;
        createEntityTableViaREST({
          token,
          ...DATABASE_SERVICE,
          tables: [DATABASE_SERVICE.entity],
        });

        cy.request({
          method: 'GET',
          url: `/api/v1/metadata/types?category=field&limit=12`,
          headers: { Authorization: `Bearer ${token}` },
        }).then(({ body }) => {
          const integerProp = body.data.find((item) => item.name === 'integer');

          cy.request({
            method: 'GET',
            url: `/api/v1/metadata/types/name/table`,
            headers: { Authorization: `Bearer ${token}` },
          }).then(({ body }) => {
            tableSchemaId = body.id;

            customPropertiesArray.map((item) => {
              cy.request({
                method: 'PUT',
                url: `/api/v1/metadata/types/${tableSchemaId}`,
                headers: { Authorization: `Bearer ${token}` },
                body: {
                  ...item,
                  propertyType: {
                    id: integerProp.id ?? '',
                    type: 'type',
                  },
                },
              });
            });
          });
        });
      });
    });

    it('Verify custom properties in right panel and custom properties tab', () => {
      visitEntityDetailsPage({
        term: DATABASE_SERVICE.entity.name,
        serviceName: DATABASE_SERVICE.service.name,
        entity: DATA_ASSETS.tables,
      });
      verifyCustomPropertyRows();
    });

    after(() => {
      deleteCustomProperties(tableSchemaId, token);
    });
  });
});
