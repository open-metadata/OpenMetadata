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
import { interceptURL, verifyResponseStatusCode } from '../../common/common';
import {
  createGlossary,
  createGlossaryTerms,
  deleteGlossary,
} from '../../common/GlossaryUtils';
import {
  addCustomPropertiesForEntity,
  customPropertiesArray,
  CustomProperty,
  CustomPropertyType,
  deleteCreatedProperty,
  deleteCustomProperties,
  deleteCustomPropertyForEntity,
  editCreatedProperty,
  generateCustomProperty,
  setValueForProperty,
  validateValueForProperty,
  verifyCustomPropertyRows,
} from '../../common/Utils/CustomProperty';
import {
  createEntityTableViaREST,
  visitEntityDetailsPage,
} from '../../common/Utils/Entity';
import { getToken } from '../../common/Utils/LocalStorage';
import { updateJWTTokenExpiryTime } from '../../common/Utils/Login';
import { ENTITIES, JWT_EXPIRY_TIME_MAP, uuid } from '../../constants/constants';
import { EntityType, SidebarItem } from '../../constants/Entity.interface';
import { DATABASE_SERVICE } from '../../constants/EntityConstant';
import { GLOSSARY_1 } from '../../constants/glossary.constant';

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

describe('Custom Properties should work properly', { tags: 'Settings' }, () => {
  before(() => {
    cy.login();
    updateJWTTokenExpiryTime(JWT_EXPIRY_TIME_MAP['2 hours']);
  });

  after(() => {
    updateJWTTokenExpiryTime(JWT_EXPIRY_TIME_MAP['1 hour']);
  });

  beforeEach(() => {
    cy.login();
  });

  afterEach(() => {
    cy.logout();
  });

  [
    'Integer',
    'String',
    'Markdown',
    'Duration',
    'Email',
    'Number',
    'Sql Query',
    // 'Time',
    // 'Time Interval',
    'Timestamp',
  ].forEach((type) => {
    describe(`Add update and delete ${type} custom properties`, () => {
      Object.values(ENTITIES).forEach((entity) => {
        const propertyName = `addcyentity${entity.name}test${uuid()}`;

        it(`Add/Update/Delete ${type} custom property for ${entity.name} Entities`, () => {
          interceptURL(
            'GET',
            `/api/v1/metadata/types/name/${entity.name}*`,
            'getEntity'
          );
          cy.settingClick(entity.entityApiType, true);

          verifyResponseStatusCode('@getEntity', 200);

          // Getting the property
          addCustomPropertiesForEntity({
            propertyName,
            customPropertyData: entity,
            customType: type,
          });

          // Navigating back to custom properties page
          cy.settingClick(entity.entityApiType, true);
          verifyResponseStatusCode('@getEntity', 200);

          // `Edit created property for ${entity.name} entity`
          interceptURL(
            'GET',
            `/api/v1/metadata/types/name/${entity.name}*`,
            'getEntity'
          );

          // Selecting the entity
          cy.settingClick(entity.entityApiType, true);

          verifyResponseStatusCode('@getEntity', 200);
          editCreatedProperty(propertyName);

          // `Delete created property for ${entity.name} entity`
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
  });

  describe('Add update and delete Enum custom properties', () => {
    Object.values(ENTITIES).forEach((entity) => {
      const propertyName = `addcyentity${entity.name}test${uuid()}`;

      it(`Add/Update/Delete Enum custom property for ${entity.name} Entities`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);

        addCustomPropertiesForEntity({
          propertyName,
          customPropertyData: entity,
          customType: 'Enum',
          enumConfig: entity.enumConfig,
        });

        // Navigating back to custom properties page
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);

        // `Edit created property for ${entity.name} entity`
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);
        editCreatedProperty(propertyName, 'Enum');

        // `Delete created property for ${entity.name} entity`
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

  describe('Add update and delete Entity Reference custom properties', () => {
    Object.values(ENTITIES).forEach((entity) => {
      const propertyName = `addcyentity${entity.name}test${uuid()}`;

      it(`Add/Update/Delete Entity Reference custom property for ${entity.name} Entities`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);

        addCustomPropertiesForEntity({
          propertyName,
          customPropertyData: entity,
          customType: 'Entity Reference',
          entityReferenceConfig: entity.entityReferenceConfig,
        });

        // Navigating back to custom properties page
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);

        // `Edit created property for ${entity.name} entity`
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);
        editCreatedProperty(propertyName, 'Entity Reference');

        // `Delete created property for ${entity.name} entity`
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

  describe('Add update and delete Entity Reference List custom properties', () => {
    Object.values(ENTITIES).forEach((entity) => {
      const propertyName = `addcyentity${entity.name}test${uuid()}`;

      it(`Add/Update/Delete Entity Reference List custom property for ${entity.name} Entities`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);

        addCustomPropertiesForEntity({
          propertyName,
          customPropertyData: entity,
          customType: 'Entity Reference List',
          entityReferenceConfig: entity.entityReferenceConfig,
        });

        // Navigating back to custom properties page
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);

        // `Edit created property for ${entity.name} entity`
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);
        editCreatedProperty(propertyName, 'Entity Reference List');

        // `Delete created property for ${entity.name} entity`
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

  // eslint-disable-next-line jest/no-disabled-tests
  describe.skip('Add update and delete Date custom properties', () => {
    Object.values(ENTITIES).forEach((entity) => {
      const propertyName = `addcyentity${entity.name}test${uuid()}`;

      it(`Add Date custom property for ${entity.name} Entities`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);

        addCustomPropertiesForEntity({
          propertyName,
          customPropertyData: entity,
          customType: 'Date',
          formatConfig: entity.dateFormatConfig,
        });

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

  // eslint-disable-next-line jest/no-disabled-tests
  describe.skip('Add update and delete DateTime custom properties', () => {
    Object.values(ENTITIES).forEach((entity) => {
      const propertyName = `addcyentity${entity.name}test${uuid()}`;

      it(`Add DateTime custom property for ${entity.name} Entities`, () => {
        interceptURL(
          'GET',
          `/api/v1/metadata/types/name/${entity.name}*`,
          'getEntity'
        );

        // Selecting the entity
        cy.settingClick(entity.entityApiType, true);

        verifyResponseStatusCode('@getEntity', 200);

        addCustomPropertiesForEntity({
          propertyName,
          customPropertyData: entity,
          customType: 'Date Time',
          formatConfig: entity.dateTimeFormatConfig,
        });

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

  describe('Custom properties for glossary and glossary terms', () => {
    const propertyName = `addcyentity${glossaryTerm.name}test${uuid()}`;
    const properties = Object.values(CustomPropertyType).join(', ');

    it('test custom properties in advanced search modal', () => {
      cy.settingClick(glossaryTerm.entityApiType, true);

      addCustomPropertiesForEntity({
        propertyName,
        customPropertyData: glossaryTerm,
        customType: 'Integer',
      });

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

      cy.get('[data-testid="cancel-btn"]').click();
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
      const glossary = GLOSSARY_1;
      glossary.terms = [GLOSSARY_1.terms[0]];

      createGlossary(GLOSSARY_1, false);
      createGlossaryTerms(glossary);

      cy.settingClick(glossaryTerm.entityApiType, true);

      Object.values(CustomPropertyType).forEach((type) => {
        addCustomPropertiesForEntity({
          propertyName: lowerCase(type),
          customPropertyData: glossaryTerm,
          customType: type,
        });

        cy.settingClick(glossaryTerm.entityApiType, true);
      });

      visitEntityDetailsPage({
        term: glossary.terms[0].name,
        serviceName: glossary.terms[0].fullyQualifiedName,
        entity: 'glossaryTerms' as EntityType,
        dataTestId: `${glossary.name}-${glossary.terms[0].name}`,
      });

      // set custom property value
      Object.values(CustomPropertyType).forEach((type) => {
        setValueForProperty(
          lowerCase(type),
          customPropertyValue[type].value,
          lowerCase(type)
        );
        validateValueForProperty(
          lowerCase(type),
          customPropertyValue[type].value,
          lowerCase(type)
        );
      });

      // update custom property value
      Object.values(CustomPropertyType).forEach((type) => {
        setValueForProperty(
          lowerCase(type),
          customPropertyValue[type].newValue,
          lowerCase(type)
        );
        validateValueForProperty(
          lowerCase(type),
          customPropertyValue[type].newValue,
          lowerCase(type)
        );
      });

      // delete custom properties
      Object.values(CustomPropertyType).forEach((customPropertyType) => {
        const type = glossaryTerm.entityApiType as EntityType;
        const property = customPropertyValue[customPropertyType].property ?? {};

        deleteCustomPropertyForEntity({
          property: {
            ...property,
            name: lowerCase(customPropertyType),
          } as CustomProperty,
          type,
        });
      });

      // delete glossary and glossary term
      cy.sidebarClick(SidebarItem.GLOSSARY);
      deleteGlossary(glossary.name);
    });
  });

  describe('Verify custom properties in right panel and custom properties tab', () => {
    let tableSchemaId = '';
    let token = '';
    before(() => {
      cy.login();

      cy.getAllLocalStorage().then((data) => {
        token = getToken(data);
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
        entity: EntityType.Table,
      });
      verifyCustomPropertyRows();
    });

    after(() => {
      deleteCustomProperties(tableSchemaId, token);
    });
  });
});
