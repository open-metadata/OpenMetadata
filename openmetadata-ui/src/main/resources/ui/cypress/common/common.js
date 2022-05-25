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

export const uuid = () => Cypress._.random(0, 1e6);

const isDatabaseService = (type) => type === 'database';

export const hanldeIngestionRetry = (type, count = 0) => {
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
    if (isDatabaseService(type)) {
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

export const testServiceCreationAndIngestion = (
  serviceType,
  connectionInput,
  addIngestionInput,
  type = 'database'
) => {
  const serviceName = `${serviceType}-ci-test-${uuid()}`;

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
  cy.contains('Connection Details').should('be.visible');

  connectionInput();

  // Test the connection
  cy.get('[data-testid="test-connection-btn"]').should('exist');
  cy.get('[data-testid="test-connection-btn"]').click();

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

    // Set all the sliders to off to disable sample data, data profiler etc.
    cy.get('[data-testid="toggle-button-ingest-sample-data"]')
      .should('exist')
      .click();
    cy.get('[data-testid="toggle-button-data-profiler"]')
      .should('exist')
      .click();
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
  cy.get('[data-testid="deploy-button"]').should('be.visible').click();

  // check success
  cy.get('[data-testid="success-line"]').should('be.visible');
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

  hanldeIngestionRetry(type);
};

export const goToAddNewServicePage = () => {
  cy.visit('/');
  // cy.loginByGoogleApi();
  cy.get('[data-testid="WhatsNewModalFeatures"]').should('be.visible');
  cy.get('[data-testid="closeWhatsNew"]').click();
  cy.get('[data-testid="WhatsNewModalFeatures"]').should('not.exist');
  cy.get('[data-testid="tables"]').should('be.visible');

  cy.get('[data-testid="menu-button"]').should('be.visible');
  cy.get('[data-testid="menu-button"]').first().click();
  cy.get('[data-testid="menu-item-Services"]').should('be.visible').click();

  // Services page
  cy.contains('Services').should('be.visible');
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
  cy.get('[data-testid="searchBox"]').should('be.visible');
  cy.get('[data-testid="searchBox"]').scrollIntoView().type(term);
  cy.get('.tw-cursor-pointer > [data-testid="image"]').click();
};

export const testSampleData = (entity) => {
  cy.goToHomePage();

  // initially sample data should not be present
  searchEntity(entity.term);
  cy.wait(500);
  cy.get('[data-testid="table-link"]').first().should('be.visible').click();
  cy.get('[data-testid="Sample Data"]').should('be.visible').click();
  cy.contains('No sample data available').should('be.visible');

  // go to service details and modify ingestion to enable sample data
  cy.get(':nth-child(1) > .link-title').should('be.visible').click();
  cy.wait(500);
  cy.get('[data-testid="table-container"]').contains(entity.db);

  cy.get('[data-testid="Ingestions"]').should('be.visible').click();
  cy.get('[data-testid="edit"]').should('be.visible').click();
  cy.get('[data-testid="toggle-button-ingest-sample-data"]')
    .should('be.visible')
    .click();
  cy.get('[data-testid="toggle-button-ingest-sample-data"]')
    .should('be.visible')
    .should('have.class', 'open');
  cy.get('[data-testid="next-button"]').should('be.visible').click();

  cy.get('[data-testid="dbt-source"]').should('be.visible');
  cy.get('[data-testid="submit-btn"]').should('be.visible').click();

  cy.get('[data-testid="ingestion-type"]').should('be.visible');
  cy.get('[data-testid="deploy-button"]').should('be.visible').click();

  cy.contains('has been updated and deployed successfully').should(
    'be.visible'
  );
  cy.get('[data-testid="view-service-button"]').should('be.visible').click();
  cy.get('[data-testid="Ingestions"]')
    .should('be.visible')
    .should('have.class', 'active');

  cy.get('[data-testid="run"]').should('be.visible').click();
  cy.reload();
  hanldeIngestionRetry(entity.entityType, 1);

  searchEntity(entity.term);
  cy.wait(500);
  cy.get('[data-testid="table-link"]').first().should('be.visible').click();
  cy.get('[data-testid="Sample Data"]').should('be.visible').click();
  cy.contains('No sample data available').should('not.exist');
};
