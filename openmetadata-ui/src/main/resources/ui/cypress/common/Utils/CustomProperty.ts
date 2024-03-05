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
import { EntityType } from '../../constants/Entity.interface';
import {
  descriptionBox,
  interceptURL,
  uuid,
  verifyResponseStatusCode,
} from '../common';

export enum CustomPropertyType {
  STRING = 'String',
  INTEGER = 'Integer',
  MARKDOWN = 'Markdown',
}

export interface CustomProperty {
  name: string;
  type: CustomPropertyType;
  description: string;
}

export const generateCustomProperty = (type: CustomPropertyType) => ({
  name: `cypress${type.toLowerCase()}${Date.now()}`,
  type,
  description: `${type} cypress Property`,
});

export const createCustomPropertyForEntity = ({
  property,
  type,
}: {
  property: CustomProperty;
  type: EntityType;
}) => {
  interceptURL('GET', `/api/v1/metadata/types/name/*`, 'getEntity');

  // Selecting the entity
  cy.settingClick(type, true);

  verifyResponseStatusCode('@getEntity', 200);

  // Add Custom property for selected entity
  cy.get('[data-testid="add-field-button"]').click();

  cy.get('[data-testid="name"]').clear().type(property.name);

  cy.get('[data-testid="propertyType"]').click();
  cy.get(`[title="${property.type}"]`).click();

  cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
    .clear()
    .type(property.description);

  // Check if the property got added
  cy.intercept('/api/v1/metadata/types/name/*?fields=customProperties').as(
    'customProperties'
  );
  cy.get('[data-testid="create-button"]').scrollIntoView().click();

  cy.wait('@customProperties');
  cy.get('.ant-table-row').should('contain', property.name);
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

export const setValueForProperty = (propertyName, value: string) => {
  cy.get('[data-testid="custom_properties"]').click();

  cy.get('tbody').should('contain', propertyName);

  // Adding value for the custom property

  // Navigating through the created custom property for adding value
  cy.get(`[data-row-key="${propertyName}"]`)
    .find('[data-testid="edit-icon"]')
    .scrollIntoView()
    .as('editbutton');

  cy.get('@editbutton').click();

  interceptURL('PATCH', `/api/v1/*/*`, 'patchEntity');
  // Checking for value text box or markdown box
  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="value-input"]').length > 0) {
      cy.get('[data-testid="value-input"]').clear().type(value);
      cy.get('[data-testid="inline-save-btn"]').click();
    } else if (
      $body.find(
        '.toastui-editor-md-container > .toastui-editor > .ProseMirror'
      )
    ) {
      cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
        .clear()
        .type(value);
      cy.get('[data-testid="save"]').click();
    }
  });
  verifyResponseStatusCode('@patchEntity', 200);
  cy.get(`[data-row-key="${propertyName}"]`).should(
    'contain',
    value.replace(/\*|_/gi, '')
  );
};
export const validateValueForProperty = (propertyName, value: string) => {
  cy.get('.ant-tabs-tab').first().click();
  cy.get(
    '[data-testid="entity-right-panel"] [data-testid="custom-properties-table"]',
    {
      timeout: 10000,
    }
  ).scrollIntoView();
  cy.get(`[data-row-key="${propertyName}"]`).should(
    'contain',
    value.replace(/\*|_/gi, '')
  );
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
  ).should('have.length', 5);
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

export const addCustomPropertiesForEntity = (
  propertyName: string,
  customPropertyData: { description: string },
  customType: string,
  value: { values: string[]; multiSelect: boolean }
) => {
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

  cy.get('[data-testid="propertyType"]').click();
  cy.get(`[title="${customType}"]`).click();

  if (customType === 'Enum') {
    value.values.forEach((val) => {
      cy.get('#root\\/customPropertyConfig').type(`${val}{enter}`);
    });

    cy.clickOutside();

    if (value.multiSelect) {
      cy.get('#root\\/multiSelect').scrollIntoView().click();
    }
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

export const editCreatedProperty = (propertyName: string, type: string) => {
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

  interceptURL('PATCH', '/api/v1/metadata/types/*', 'checkPatchForDescription');

  cy.get('button[type="submit"]').scrollIntoView().click();

  cy.wait('@checkPatchForDescription', { timeout: 15000 });

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
