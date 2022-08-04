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

/// <reference types="cypress" />

export const uuid = () => Cypress._.random(0, 1e6);

const isDatabaseService = (type) => type === 'database';

export const handleIngestionRetry = (type, testIngestionButton, count = 0) => {
  // ingestions page
  const retryTimes = 25;
  let retryCount = count;
  const testIngestionsTab = () => {
    cy.get('[data-testid="Ingestions"]').should('be.visible');
    cy.get('[data-testid="Ingestions"] >> [data-testid="filter-count"]').should(
      'have.text',
      1
    );
    // click on the tab only for the first time
    if (retryCount === 0) {
      cy.get('[data-testid="Ingestions"]').click();
    }
    if (isDatabaseService(type) && testIngestionButton) {
      cy.get('[data-testid="add-new-ingestion-button"]').should('be.visible');
    }
  };
  const checkSuccessState = () => {
    testIngestionsTab();
    retryCount++;
    // the latest run should be success
    cy.get('.tableBody-row > :nth-child(4)').then(($ingestionStatus) => {
      if (
        ($ingestionStatus.text() === 'Running' ||
          $ingestionStatus.text() === 'Queued') &&
        retryCount <= retryTimes
      ) {
        // retry after waiting for 20 seconds
        cy.wait(20000);
        cy.reload();
        checkSuccessState();
      } else {
        cy.get('.tableBody-row > :nth-child(4)').should('have.text', 'Success');
      }
    });
  };

  checkSuccessState();
};

//Storing the created service name and the type of service for later use

export const testServiceCreationAndIngestion = (
  serviceType,
  connectionInput,
  addIngestionInput,
  serviceName,
  type = 'database',
  testIngestionButton = true
) => {
  //Storing the created service name and the type of service
  // Select Service in step 1
  cy.get(`[data-testid="${serviceType}"]`).should('exist').click();
  cy.get('[data-testid="next-button"]').should('exist').click();

  // Enter service name in step 2
  cy.get('[data-testid="service-name"]').should('exist').type(serviceName);
  cy.get('[data-testid="next-button"]').click();

  // Connection Details in step 3
  cy.get('[data-testid="add-new-service-container"]')
    .parent()
    .parent()
    .scrollTo('top', {
      ensureScrollable: false,
    });
  cy.contains('Connection Details').scrollIntoView().should('be.visible');

  connectionInput();

  // Test the connection
  cy.get('[data-testid="test-connection-btn"]').should('exist');
  cy.get('[data-testid="test-connection-btn"]').click();
  cy.wait(500);
  cy.contains('Connection test was successful').should('exist');
  cy.get('[data-testid="submit-btn"]').should('exist').click();

  // check success
  cy.get('[data-testid="success-line"]').should('be.visible');
  cy.contains(`"${serviceName}"`).should('be.visible');
  cy.contains('has been created successfully').should('be.visible');

  cy.get('[data-testid="add-ingestion-button"]').should('be.visible');
  cy.get('[data-testid="add-ingestion-button"]').click();

  // Add ingestion page
  cy.get('[data-testid="add-ingestion-container"]').should('be.visible');

  if (isDatabaseService(type)) {
    cy.get('[data-testid="schema-filter-pattern-checkbox"]').should(
      'be.visible'
    );

    // Set mark-deleted slider to off to disable it.
    cy.get('[data-testid="toggle-button-mark-deleted"]')
      .should('exist')
      .click();
  }

  addIngestionInput();

  cy.get('[data-testid="next-button"]').should('exist').click();

  // Configure DBT Model
  if (isDatabaseService(type)) {
    cy.contains('Configure DBT Model').should('be.visible');
    cy.get('[data-testid="dbt-source"]').should('be.visible').select('');

    cy.get('[data-testid="submit-btn"]').should('be.visible').click();
  }

  // Schedule & Deploy
  cy.contains('Schedule for Ingestion').should('be.visible');
  cy.get('[data-testid="ingestion-type"]').should('be.visible').select('hour');
  cy.get('[data-testid="deploy-button"]').should('be.visible').click();

  // check success
  cy.get('[data-testid="success-line"]', { timeout: 15000 }).should(
    'be.visible'
  );
  cy.contains(`"${serviceName}_metadata"`).should('be.visible');
  cy.contains('has been created and deployed successfully').should(
    'be.visible'
  );
  // On the Right panel
  cy.contains('Metadata Ingestion Added & Deployed Successfully').should(
    'be.visible'
  );

  // wait for ingestion to run
  cy.clock();
  cy.wait(10000);

  cy.get('[data-testid="view-service-button"]').should('be.visible');
  cy.get('[data-testid="view-service-button"]').click();

  handleIngestionRetry(type, testIngestionButton);
};

export const deleteCreatedService = (typeOfService, service_Name) => {
  // cy.goToHomePage();

  // cy.get(
  //   '.tw-ml-5 > [data-testid="dropdown-item"] > div > [data-testid="menu-button"]'
  // )
  //   .scrollIntoView()
  //   .should('be.visible')
  //   .click();
  // cy.get('[data-testid="menu-item-Services"]').should('be.visible').click();
  // cy.wait(1000);

  // //redirecting to services page
  // cy.contains('[data-testid="tab"]', `${typeOfService} Service`).click();

  // cy.visit('')

  cy.visit('http://localhost:8585/settings', { failOnStatusCode: false });

  cy.get('[data-testid="WhatsNewModalFeatures"]').should('be.visible');
  cy.get('[data-testid="closeWhatsNew"]').click();
  cy.get('[data-testid="WhatsNewModalFeatures"]').should('not.exist');

  cy.contains(typeOfService).should('be.visible').click();

  //click on created service
  cy.get(`[data-testid="service-name-${service_Name}"]`)
    .should('exist')
    .should('be.visible')
    .click();

  cy.get(`[data-testid="inactive-link"]`)
    .should('exist')
    .should('be.visible')
    .invoke('text')
    .then((text) => {
      expect(text).to.equal(service_Name);
    });

  cy.wait(1000);

  cy.get('[data-testid="Manage"]').should('exist').should('be.visible').click();
  cy.get('[data-testid="delete-button"]')
    .scrollIntoView()
    .should('exist')
    .should('be.visible')
    .click();
  cy.get('[data-testid="confirmation-text-input"]')
    .should('be.visible')
    .type('DELETE');
  cy.get('[data-testid="confirm-button"]').should('be.visible').click();
  cy.wait(2000);
  cy.get('[class="Toastify__toast-body"] >div')
    .eq(1)
    .should('exist')
    .should('be.visible')
    .should('have.text', `${typeOfService} Service deleted successfully!`);
};

export const goToAddNewServicePage = (typeOfService) => {
  cy.visit('/');
  cy.get('[data-testid="WhatsNewModalFeatures"]').should('be.visible');
  cy.get('[data-testid="closeWhatsNew"]').click();
  cy.get('[data-testid="WhatsNewModalFeatures"]').should('not.exist');
  cy.get('[data-testid="tables"]').should('be.visible');
  cy.get('[data-testid="menu-button"]').should('be.visible');
  cy.get('[data-testid="menu-button"]').first().click();
  cy.get('[data-testid="menu-item-Services"]').should('be.visible').click();
  // Services page
  cy.contains('Services').should('be.visible');
  cy.wait(500);
  cy.get('.activeCategory > .tw-py-px').then(($databaseServiceCount) => {
    if ($databaseServiceCount.text() === '0') {
      cy.get('[data-testid="add-service-button"]').should('be.visible').click();
    } else {
      cy.get('[data-testid="add-new-service-button"]')
        .should('be.visible')
        .click();
    }
  });
  // Add new service page
  cy.url().should('include', 'databaseServices/add-service');
  cy.get('[data-testid="header"]').should('be.visible');
  cy.contains('Add New Service').should('be.visible');
  cy.get('[data-testid="service-category"]').should('be.visible');
};

export const addNewServicePage = (typeOfService) => {
  cy.visit('http://localhost:8585/settings', { failOnStatusCode: false });

  cy.get('[data-testid="WhatsNewModalFeatures"]').should('be.visible');
  cy.get('[data-testid="closeWhatsNew"]').click();
  cy.get('[data-testid="WhatsNewModalFeatures"]').should('not.exist');
  cy.wait(1000);
  cy.contains(typeOfService).should('be.visible').click();
  cy.get('[data-testid="services-container"]').then(($databaseServiceCount) => {
    if (!$databaseServiceCount) {
      cy.get('[data-testid="add-service-button"]').should('be.visible').click();
    } else {
      cy.get('[data-testid="add-new-service-button"]')
        .should('be.visible')
        .click();
    }
  });
};

export const testServiceSampleData = (database, schema, table) => {
  cy.get('[data-testid="Databases"]').click();
  cy.get('[data-testid="column"] > :nth-child(1)')
    .should('be.visible')
    .contains(database);

  cy.get('[data-testid="column"] > :nth-child(1) > a').click();
  cy.get('[data-testid="table-column"] > :nth-child(1)')
    .should('be.visible')
    .contains(schema);

  cy.get('[data-testid="table-column"] > :nth-child(1) > a').click();
  cy.get('.odd-row > :nth-child(1) > a').should('be.visible').contains(table);

  cy.get('.odd-row > :nth-child(1) > a').click();
  cy.get('[data-testid="inactive-link"]').should('be.visible').contains(table);
  cy.get('[data-testid="Schema"]').should('be.visible');
};

/**
 * visit any of the entity tab from home page
 * @param {string} id -> data-testid is required
 */
export const visitEntityTab = (id) => {
  cy.get(`[data-testid="${id}"]`).click();
  cy.get(`[data-testid="${id}-tab"]`).should('be.visible');
};
/**
 * Search for entities through the search bar
 * @param {string} term Entity name
 */
export const searchEntity = (term) => {
  cy.get('[data-testid="searchBox"]').scrollIntoView().should('be.visible');
  cy.get('[data-testid="searchBox"]').type(`${term}{enter}`);
  cy.get('[data-testid="suggestion-overlay"]').click(1, 1);
};

// add new tag to entity and its table
export const addNewTagToEntity = (entity, term) => {
  searchEntity(entity);
  cy.wait(500);
  cy.get('[data-testid="table-link"]').first().contains(entity).click();
  cy.get(
    '[data-testid="tags-wrapper"] > [data-testid="tag-container"] > div > :nth-child(1) > [data-testid="tags"] > .tw-no-underline'
  )
    .should('be.visible')
    .scrollIntoView()
    .click();

  cy.get('[class*="-control"]').should('be.visible').type(term);
  cy.wait(500);
  cy.get('[id*="-option-0"]').should('be.visible').click();
  cy.get(
    '[data-testid="tags-wrapper"] > [data-testid="tag-container"]'
  ).contains(term);
  cy.get('[data-testid="saveAssociatedTag"]').should('be.visible').click();
  cy.get('[data-testid="entity-tags"]')
    .scrollIntoView()
    .should('be.visible')
    .contains(term);

  cy.get('[data-testid="table-body"] > :nth-child(1) > :nth-child(5)')
    .contains('Tags')
    .should('be.visible')
    .click();

  cy.get('[class*="-control"]')
    .scrollIntoView()
    .should('be.visible')
    .type(term);
  cy.wait(500);
  cy.get('[id*="-option-0"]').should('be.visible').click();
  cy.get('[data-testid="saveAssociatedTag"]')
    .scrollIntoView()
    .should('be.visible')
    .click();
  cy.get('[data-testid="table-body"] > :nth-child(1) > :nth-child(5)')
    .scrollIntoView()
    .contains(term)
    .should('exist');
};

export const addUser = (username, email) => {
  cy.get('[data-testid="email"]')
    .scrollIntoView()
    .should('exist')
    .should('be.visible')
    .type(email);
  cy.get('[data-testid="displayName"]')
    .should('exist')
    .should('be.visible')
    .type(username);
  cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
    .should('exist')
    .should('be.visible')
    .type('Adding user');
  cy.get('[data-testid="save-user"]').scrollIntoView().click();
};

export const softDeleteUser = (username) => {
  cy.get('[data-testid="searchbar"]')
    .should('exist')
    .should('be.visible')
    .type(username);
  cy.wait(1000);

  //Click on delete button for searched user
  cy.get(
    ':nth-child(1) > :nth-child(4) > .ant-space > .ant-space-item > .ant-btn > [data-testid="image"]'
  )
    .should('exist')
    .should('be.visible')
    .click();

  //Soft deleting the user
  cy.get('[data-testid="soft-delete"]').click();
  cy.get('[data-testid="confirmation-text-input"]').type('DELETE');
  cy.get('[data-testid="confirm-button"]')
    .should('exist')
    .should('be.visible')
    .click();

  cy.wait(1000);

  cy.get('.Toastify__toast-body > :nth-child(2)').should(
    'have.text',
    'User deleted successfully!'
  );

  //Closing the toast message
  cy.get('.Toastify__close-button > svg')
    .should('exist')
    .should('be.visible')
    .click();

  //Verifying the deleted user
  cy.get('[data-testid="searchbar"]')
    .should('exist')
    .should('be.visible')
    .clear()
    .type(username);

  cy.wait(1000);
  cy.get('.ant-table-placeholder > .ant-table-cell').should(
    'not.contain',
    username
  );
};

export const restoreUser = (username) => {
  cy.get('.ant-switch-handle').should('exist').should('be.visible').click();
  cy.wait(1000);
  cy.get(
    ':nth-child(1) > :nth-child(4) > .ant-space > :nth-child(1) > .ant-btn'
  )
    .should('exist')
    .should('be.visible')
    .click();
  cy.get('.ant-modal-body > p').should(
    'contain',
    `Are you sure you want to restore ${username}?`
  );
  cy.get('.ant-modal-footer > .ant-btn-primary')
    .should('exist')
    .should('be.visible')
    .click();
  cy.wait(1000);
  cy.get('.Toastify__toast-body > :nth-child(2)').should(
    'contain',
    'User restored successfully!'
  );

  //Closing toast message
  cy.get('.Toastify__close-button > svg')
    .should('exist')
    .should('be.visible')
    .click();

  //Verifying the restored user
  cy.get('.ant-switch').should('exist').should('be.visible').click();

  cy.get('[data-testid="searchbar"]')
    .should('exist')
    .should('be.visible')
    .type(username);

  cy.wait(1000);
  cy.get('.ant-table-row > :nth-child(1)').should('contain', username);
};

export const deleteSoftDeletedUser = (username) => {
  cy.get('.ant-switch-handle').should('exist').should('be.visible').click();

  cy.wait(1000);

  cy.get(':nth-child(2) > .ant-btn > [data-testid="image"]')
    .should('exist')
    .should('be.visible')
    .click();
  cy.get('[data-testid="confirmation-text-input"]').type('DELETE');
  cy.get('[data-testid="confirm-button"]')
    .should('exist')
    .should('be.visible')
    .click();

  cy.wait(1000);

  cy.get('.Toastify__toast-body > :nth-child(2)').should(
    'have.text',
    'User deleted successfully!'
  );

  //Closing toast message
  cy.get('.Toastify__close-button > svg')
    .should('exist')
    .should('be.visible')
    .click();

  cy.get('.ant-table-placeholder > .ant-table-cell').should(
    'not.contain',
    username
  );

  cy.get('.ant-table-placeholder > .ant-table-cell')
    .should('be.visible')
    .click();

  cy.get('[data-testid="searchbar"]')
    .should('exist')
    .should('be.visible')
    .type(username);

  cy.wait(1000);

  cy.get('.ant-table-placeholder > .ant-table-cell').should(
    'not.contain',
    username
  );
};

export const addCustomPropertiesForEntity = (entityType, customType, value) => {
  const propertyName = `entity${entityType.name}test${uuid()}`;
  //Click on the Entity name
  // cy.contains(entityType.name).scrollIntoView().should('be.visible').click();

  cy.get(
    `[data-testid*="${entityType.name}"] > [data-testid="entity-displayName"]`
  )
    .should('be.visible')
    .click();
  cy.wait(1000);

  //Add Custom property for selected entity
  cy.get('[data-testid="add-field-button"]')
    .should('exist')
    .should('be.visible')
    .click();
  cy.get('[data-testid="name"]').should('be.visible').type(propertyName);
  cy.get('select').select(customType);
  cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
    .should('be.visible')
    .type(entityType.description);
  cy.get('[data-testid="create-custom-field"]').scrollIntoView().click();

  //Check if the property got added
  cy.get('[data-testid="data-row"]').should('contain', propertyName);

  //Navigating to home page
  cy.clickOnLogo();

  //Checking the added property in Entity

  cy.get(`[data-testid*="${entityType.name}"] > .ant-btn > span`)
    .scrollIntoView()
    .should('be.visible')
    .click();

  cy.wait(1000);
  cy.get('[data-testid="table-link"]')
    .first()
    .should('exist')
    .should('be.visible')
    .click();

  cy.get('[data-testid="Custom Properties"]')
    .should('exist')
    .should('be.visible')
    .click();
  cy.get('[data-testid="table-body"]').should('contain', propertyName);

  //Adding value for the custom property

  //Navigating through the created custom property for adding value
  cy.get('[data-testid="data-row"]')
    .contains(propertyName)
    .scrollIntoView()
    .next('td')
    .contains('No data')
    .next('[data-testid="edit-icon"]')
    .as('editbutton');

  cy.wait(1000);

  cy.get('@editbutton').should('exist').should('be.visible').click();

  //Checking for value text box or markdown box
  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="value-input"]').length > 0) {
      cy.get('[data-testid="value-input"]').should('be.visible').type(value);
      cy.get('[data-testid="save-value"]').click();
    } else if (
      $body.find(
        '.toastui-editor-md-container > .toastui-editor > .ProseMirror'
      )
    ) {
      cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
        .should('be.visible')
        .type(value);
      cy.get('[data-testid="save"]').click();
    }
  });

  //Checking the added value to the property
  cy.get('[data-testid="data-row"]')
    .contains(propertyName)
    .scrollIntoView()
    .next('td')
    .as('value');

  cy.get('@value').should('contain', value);

  //returning the property name since it needs to be deleted and updated
  return propertyName;
};

export const editCreatedProperty = (entityType, propertyName) => {
  //Navigating to entity
  //cy.contains(entityType.name).scrollIntoView().should('be.visible').click();
  cy.get(
    `[data-testid*="${entityType.name}"] > [data-testid="entity-displayName"]`
  )
    .should('be.visible')
    .click();

  //Fetching for edit button
  cy.get('[data-testid="table-body"]')
    .children()
    .contains(propertyName)
    .scrollIntoView()
    .nextUntil('button')
    .find('[data-testid="edit-button"]')
    .as('editbutton');

  cy.get('@editbutton').click();

  cy.get('.toastui-editor-md-container > .toastui-editor > .ProseMirror')
    .should('be.visible')
    .clear()
    .type('This is new description');

  cy.get('[data-testid="save"]').should('be.visible').click();

  //Fetching for updated descriptions for the created custom property
  cy.get('[data-testid="table-body"]')
    .children()
    .contains(propertyName)
    .nextUntil('div')
    .find('[data-testid="viewer-container"]')
    .should('contain', 'This is new description');
};

export const deleteCreatedProperty = (entityType, propertyName) => {
  //Navigating to created entity

  cy.get(
    `[data-testid*="${entityType.name}"] > [data-testid="entity-displayName"]`
  );

  //Fetching for delete button

  cy.get('[data-testid="table-body"]')
    .children()
    .contains(propertyName)
    .nextUntil('button')
    .find('[data-testid="delete-button"]')
    .as('deletebutton');

  cy.get('@deletebutton').click();

  //Checking property name is present on the delete pop-up
  cy.get('[data-testid="body-text"] > p').should('contain', propertyName);

  cy.get('[data-testid="save-button"]').should('be.visible').click();

  //Checking if property got deleted successfully
  cy.get('[data-testid="table-body"]').should('not.contain', propertyName);
};
