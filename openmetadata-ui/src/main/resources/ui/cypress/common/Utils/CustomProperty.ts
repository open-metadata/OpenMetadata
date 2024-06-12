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

import {
  CUSTOM_PROPERTY_INVALID_NAMES,
  CUSTOM_PROPERTY_NAME_VALIDATION_ERROR,
} from '../../constants/constants';
import { ENTITY_REFERENCE_PROPERTIES } from '../../constants/CustomProperty.constant';
import { EntityType, ENTITY_PATH } from '../../constants/Entity.interface';
import {
  descriptionBox,
  interceptURL,
  uuid,
  verifyResponseStatusCode,
} from '../common';
import { getToken } from './LocalStorage';

export enum CustomPropertyType {
  STRING = 'String',
  INTEGER = 'Integer',
  MARKDOWN = 'Markdown',
}
export enum CustomPropertyTypeByName {
  STRING = 'string',
  INTEGER = 'integer',
  MARKDOWN = 'markdown',
  NUMBER = 'number',
  DURATION = 'duration',
  EMAIL = 'email',
  ENUM = 'enum',
  SQL_QUERY = 'sqlQuery',
  TIMESTAMP = 'timestamp',
  ENTITY_REFERENCE = 'entityReference',
  ENTITY_REFERENCE_LIST = 'entityReferenceList',
}

export interface CustomProperty {
  name: string;
  type: CustomPropertyType;
  description: string;
  propertyType: {
    name: string;
    type: string;
  };
}

export const generateCustomProperty = (type: CustomPropertyType) => ({
  name: `cypress${type.toLowerCase()}${Date.now()}`,
  type,
  description: `${type} cypress Property`,
});

export const getPropertyValues = (type: string) => {
  switch (type) {
    case 'integer':
      return {
        value: '123',
        newValue: '456',
      };
    case 'string':
      return {
        value: 'string value',
        newValue: 'new string value',
      };
    case 'markdown':
      return {
        value: '**Bold statement**',
        newValue: '__Italic statement__',
      };

    case 'number':
      return {
        value: '123',
        newValue: '456',
      };
    case 'duration':
      return {
        value: 'PT1H',
        newValue: 'PT2H',
      };
    case 'email':
      return {
        value: 'john@gamil.com',
        newValue: 'user@getcollate.io',
      };
    case 'enum':
      return {
        value: 'small',
        newValue: 'medium',
      };
    case 'sqlQuery':
      return {
        value: 'Select * from table',
        newValue: 'Select * from table where id = 1',
      };

    case 'timestamp':
      return {
        value: '1710831125922',
        newValue: '1710831125923',
      };
    case 'entityReference':
      return {
        value: 'Adam Matthews',
        newValue: 'Aaron Singh',
      };

    case 'entityReferenceList':
      return {
        value: 'Aaron Johnson,Organization',
        newValue: 'Aaron Warren',
      };

    default:
      return {
        value: '',
        newValue: '',
      };
  }
};

export const deleteCustomPropertyForEntity = ({
  property,
  type,
}: {
  property: CustomProperty;
  type: EntityType;
}) => {
  interceptURL('GET', `/api/v1/metadata/types/name/*`, 'getEntity');
  interceptURL('PATCH', `/api/v1/metadata/types/*`, 'patchEntity');
  // Selecting the entity
  cy.settingClick(type, true);

  verifyResponseStatusCode('@getEntity', 200);

  cy.get(
    `[data-row-key="${property.name}"] [data-testid="delete-button"]`
  ).click();

  cy.get('[data-testid="modal-header"]').should('contain', property.name);

  cy.get('[data-testid="save-button"]').click();

  verifyResponseStatusCode('@patchEntity', 200);
};

export const setValueForProperty = (
  propertyName: string,
  value: string,
  propertyType: string
) => {
  cy.get('[data-testid="custom_properties"]').click();

  cy.get('tbody').should('contain', propertyName);

  // Adding value for the custom property

  // Navigating through the created custom property for adding value
  cy.get(`[data-row-key="${propertyName}"]`)
    .find('[data-testid="edit-icon"]')
    .scrollIntoView()
    .as('editbutton');

  cy.get('@editbutton').should('be.visible').click({ force: true });

  interceptURL('PATCH', `/api/v1/*/*`, 'patchEntity');
  // Checking for value text box or markdown box

  switch (propertyType) {
    case 'markdown':
      cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
        .should('be.visible')
        .clear()
        .type(value);
      cy.get('[data-testid="save"]').click();

      break;

    case 'email':
      cy.get('[data-testid="email-input"]')
        .should('be.visible')
        .clear()
        .type(value);
      cy.get('[data-testid="inline-save-btn"]').click();

      break;

    case 'duration':
      cy.get('[data-testid="duration-input"]')
        .should('be.visible')
        .clear()
        .type(value);
      cy.get('[data-testid="inline-save-btn"]').click();

      break;

    case 'enum':
      cy.get('#enumValues').click().type(`${value}{enter}`);
      cy.clickOutside();
      cy.get('[data-testid="inline-save-btn"]').click();

      break;

    case 'sqlQuery':
      cy.get("pre[role='presentation']").last().click().type(value);
      cy.get('[data-testid="inline-save-btn"]').click();

      break;

    case 'timestamp':
      cy.get('[data-testid="timestamp-input"]')
        .should('be.visible')
        .clear()
        .type(value);
      cy.get('[data-testid="inline-save-btn"]').click();

      break;

    case 'timeInterval': {
      const [startValue, endValue] = value.split(',');
      cy.get('[data-testid="start-input"]')
        .should('be.visible')
        .clear()
        .type(startValue);
      cy.get('[data-testid="end-input"]')
        .should('be.visible')
        .clear()
        .type(endValue);
      cy.get('[data-testid="inline-save-btn"]').click();

      break;
    }

    case 'string':
    case 'integer':
    case 'number':
      cy.get('[data-testid="value-input"]')
        .should('be.visible')
        .clear()
        .type(value);
      cy.get('[data-testid="inline-save-btn"]').click();

      break;

    case 'entityReference':
    case 'entityReferenceList': {
      const refValues = value.split(',');

      refValues.forEach((val) => {
        interceptURL(
          'GET',
          `/api/v1/search/query?q=*${encodeURIComponent(val)}*`,
          'searchEntityReference'
        );
        cy.get('#entityReference').clear().type(`${val}`);
        cy.wait('@searchEntityReference');
        cy.get(`[data-testid="${val}"]`).click();
      });

      cy.get('[data-testid="inline-save-btn"]').click();

      break;
    }

    default:
      break;
  }

  verifyResponseStatusCode('@patchEntity', 200);

  if (propertyType === 'enum') {
    cy.get('[data-testid="enum-value"]').should('contain', value);
  } else if (propertyType === 'timeInterval') {
    const [startValue, endValue] = value.split(',');
    cy.get('[data-testid="time-interval-value"]').should('contain', startValue);
    cy.get('[data-testid="time-interval-value"]').should('contain', endValue);
  } else if (propertyType === 'sqlQuery') {
    cy.get('.CodeMirror-scroll').should('contain', value);
  } else if (
    ['entityReference', 'entityReferenceList'].includes(propertyType)
  ) {
    // do nothing
  } else {
    cy.get(`[data-row-key="${propertyName}"]`).should(
      'contain',
      value.replace(/\*|_/gi, '')
    );
  }
};
export const validateValueForProperty = (
  propertyName: string,
  value: string,
  propertyType: string
) => {
  cy.get('.ant-tabs-tab').first().click();
  cy.get(
    '[data-testid="entity-right-panel"] [data-testid="custom-properties-table"]',
    {
      timeout: 10000,
    }
  ).scrollIntoView();

  if (propertyType === 'enum') {
    cy.get('[data-testid="enum-value"]').should('contain', value);
  } else if (propertyType === 'timeInterval') {
    const [startValue, endValue] = value.split(',');
    cy.get('[data-testid="time-interval-value"]').should('contain', startValue);
    cy.get('[data-testid="time-interval-value"]').should('contain', endValue);
  } else if (propertyType === 'sqlQuery') {
    cy.get('.CodeMirror-scroll').should('contain', value);
  } else if (
    ['entityReference', 'entityReferenceList'].includes(propertyType)
  ) {
    // do nothing
  } else {
    cy.get(`[data-row-key="${propertyName}"]`).should(
      'contain',
      value.replace(/\*|_/gi, '')
    );
  }
};
export const generateCustomProperties = () => {
  return {
    name: `cyCustomProperty${uuid()}`,
    description: `cyCustomProperty${uuid()}`,
  };
};
export const verifyCustomPropertyRows = () => {
  cy.get('[data-testid="custom_properties"]').click();
  cy.get('.ant-table-row').should('have.length.gte', 10);
  cy.get('.ant-tabs-tab').first().click();
  cy.get(
    '[data-testid="entity-right-panel"] [data-testid="custom-properties-table"]',
    {
      timeout: 10000,
    }
  ).scrollIntoView();
  cy.get(
    '[data-testid="entity-right-panel"] [data-testid="custom-properties-table"] tbody tr'
  ).should('have.length', 6);
};

export const deleteCustomProperties = (
  tableSchemaId: string,
  token: string
) => {
  cy.request({
    method: 'PATCH',
    url: `/api/v1/metadata/types/${tableSchemaId}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json-patch+json',
    },
    body: [
      {
        op: 'remove',
        path: '/customProperties',
      },
    ],
  });
};

export const customPropertiesArray = Array(10)
  .fill(null)
  .map(() => generateCustomProperties());

export const addCustomPropertiesForEntity = ({
  propertyName,
  customPropertyData,
  customType,
  enumConfig,
  formatConfig,
  entityReferenceConfig,
}: {
  propertyName: string;
  customPropertyData: { description: string };
  customType: string;
  enumConfig?: { values: string[]; multiSelect: boolean };
  formatConfig?: string;
  entityReferenceConfig?: string[];
}) => {
  // Add Custom property for selected entity
  cy.get('[data-testid="add-field-button"]').click();

  // validation should work
  cy.get('[data-testid="create-button"]').scrollIntoView().click();

  cy.get('#name_help').should('contain', 'Name is required');
  cy.get('#propertyType_help').should('contain', 'Property Type is required');

  cy.get('#description_help').should('contain', 'Description is required');

  // capital case validation
  cy.get('[data-testid="name"]')
    .scrollIntoView()
    .type(CUSTOM_PROPERTY_INVALID_NAMES.CAPITAL_CASE);
  cy.get('[role="alert"]').should(
    'contain',
    CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
  );

  // with underscore validation
  cy.get('[data-testid="name"]')
    .clear()
    .type(CUSTOM_PROPERTY_INVALID_NAMES.WITH_UNDERSCORE);
  cy.get('[role="alert"]').should(
    'contain',
    CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
  );

  // with space validation
  cy.get('[data-testid="name"]')
    .clear()
    .type(CUSTOM_PROPERTY_INVALID_NAMES.WITH_SPACE);
  cy.get('[role="alert"]').should(
    'contain',
    CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
  );

  // with dots validation
  cy.get('[data-testid="name"]')
    .clear()
    .type(CUSTOM_PROPERTY_INVALID_NAMES.WITH_DOTS);
  cy.get('[role="alert"]').should(
    'contain',
    CUSTOM_PROPERTY_NAME_VALIDATION_ERROR
  );

  // should allow name in another languages
  cy.get('[data-testid="name"]').clear().type('汝らヴェディア');
  // should not throw the validation error
  cy.get('#name_help').should('not.exist');

  cy.get('[data-testid="name"]').clear().type(propertyName);

  cy.get(`#root\\/propertyType`).clear().type(customType);
  cy.get(`[title="${customType}"]`).click();

  if (customType === 'Enum') {
    enumConfig.values.forEach((val) => {
      cy.get('#root\\/enumConfig').type(`${val}{enter}`);
    });

    cy.clickOutside();

    if (enumConfig.multiSelect) {
      cy.get('#root\\/multiSelect').scrollIntoView().click();
    }
  }
  if (ENTITY_REFERENCE_PROPERTIES.includes(customType)) {
    entityReferenceConfig.forEach((val) => {
      cy.get('#root\\/entityReferenceConfig').click().type(`${val}`);
      cy.get(`[title="${val}"]`).click();
    });

    cy.clickOutside();
  }

  if (['Date', 'Date Time'].includes(customType)) {
    cy.get('#root\\/formatConfig').clear().type('invalid-format');
    cy.get('[role="alert"]').should('contain', 'Format is invalid');

    cy.get('#root\\/formatConfig').clear().type(formatConfig);
  }

  cy.get(descriptionBox).clear().type(customPropertyData.description);

  // Check if the property got added
  cy.intercept('/api/v1/metadata/types/name/*?fields=customProperties').as(
    'customProperties'
  );
  cy.get('[data-testid="create-button"]').scrollIntoView().click();

  cy.wait('@customProperties');
  cy.get('.ant-table-row').should('contain', propertyName);

  // Navigating to home page
  cy.clickOnLogo();
};

export const editCreatedProperty = (propertyName: string, type?: string) => {
  // Fetching for edit button
  cy.get(`[data-row-key="${propertyName}"]`)
    .find('[data-testid="edit-button"]')
    .as('editButton');

  if (type === 'Enum') {
    cy.get(`[data-row-key="${propertyName}"]`)
      .find('[data-testid="enum-config"]')
      .should('contain', '["enum1","enum2","enum3"]');
  }

  cy.get('@editButton').click();

  cy.get(descriptionBox).clear().type('This is new description');

  if (type === 'Enum') {
    cy.get('#root\\/customPropertyConfig').type(`updatedValue{enter}`);

    cy.clickOutside();
  }

  if (ENTITY_REFERENCE_PROPERTIES.includes(type)) {
    cy.get('#root\\/customPropertyConfig').click().type(`Table{enter}`);

    cy.clickOutside();
  }

  interceptURL('PATCH', '/api/v1/metadata/types/*', 'checkPatchForDescription');

  cy.get('button[type="submit"]').scrollIntoView().click();

  /**
   * @link https://docs.cypress.io/guides/references/configuration#Timeouts
   * default responseTimeout is 30000ms which is not enough for the patch request
   * so we need to increase the responseTimeout to 50000ms
   */
  cy.wait('@checkPatchForDescription', { responseTimeout: 50000 });

  cy.get('.ant-modal-wrap').should('not.exist');

  // Fetching for updated descriptions for the created custom property
  cy.get(`[data-row-key="${propertyName}"]`)
    .find('[data-testid="viewer-container"]')
    .should('contain', 'This is new description');

  if (type === 'Enum') {
    cy.get(`[data-row-key="${propertyName}"]`)
      .find('[data-testid="enum-config"]')
      .should('contain', '["enum1","enum2","enum3","updatedValue"]');
  }
  if (ENTITY_REFERENCE_PROPERTIES.includes(type)) {
    cy.get(`[data-row-key="${propertyName}"]`)
      .find(`[data-testid="${propertyName}-config"]`)
      .should('contain', '["user","team","table"]');
  }
};

export const deleteCreatedProperty = (propertyName: string) => {
  // Fetching for delete button
  cy.get(`[data-row-key="${propertyName}"]`)
    .scrollIntoView()
    .find('[data-testid="delete-button"]')
    .click();

  // Checking property name is present on the delete pop-up
  cy.get('[data-testid="body-text"]').should('contain', propertyName);

  cy.get('[data-testid="save-button"]').should('be.visible').click();
};

export const createCustomPropertyForEntity = (prop: string) => {
  return cy.getAllLocalStorage().then((data) => {
    const token = getToken(data);

    // fetch the available property types
    return cy
      .request({
        method: 'GET',
        url: `/api/v1/metadata/types?category=field&limit=20`,
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ body }) => {
        const propertyList = body.data.filter((item) =>
          Object.values(CustomPropertyTypeByName).includes(item.name)
        );

        // fetch the entity details for which the custom property needs to be added
        return cy
          .request({
            method: 'GET',
            url: `/api/v1/metadata/types/name/${ENTITY_PATH[prop]}`,
            headers: { Authorization: `Bearer ${token}` },
          })
          .then(({ body }) => {
            const entityId = body.id;

            // Add the custom property for the entity
            propertyList.forEach((item) => {
              return cy
                .request({
                  method: 'PUT',
                  url: `/api/v1/metadata/types/${entityId}`,
                  headers: { Authorization: `Bearer ${token}` },
                  body: {
                    name: `cyCustomProperty${uuid()}`,
                    description: `cyCustomProperty${uuid()}`,
                    propertyType: {
                      id: item.id ?? '',
                      type: 'type',
                    },
                    ...(item.name === 'enum'
                      ? {
                          customPropertyConfig: {
                            config: {
                              multiSelect: true,
                              values: ['small', 'medium', 'large'],
                            },
                          },
                        }
                      : {}),
                    ...(['entityReference', 'entityReferenceList'].includes(
                      item.name
                    )
                      ? {
                          customPropertyConfig: {
                            config: ['user', 'team'],
                          },
                        }
                      : {}),
                  },
                })
                .then(({ body }) => {
                  return body.customProperties.reduce(
                    (prev, curr) => {
                      const propertyTypeName = curr.propertyType.name;

                      return {
                        ...prev,
                        [propertyTypeName]: {
                          ...getPropertyValues(propertyTypeName),
                          property: curr,
                        },
                      };
                    },
                    {} as Record<
                      string,
                      {
                        value: string;
                        newValue: string;
                        property: CustomProperty;
                      }
                    >
                  );
                });
            });
          });
      });
  });
};
