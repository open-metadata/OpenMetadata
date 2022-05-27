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

import { searchEntity, visitEntityTab } from '../../common/common';
import { FOLLOWING_TITLE, MYDATA_SUMMARY_OPTIONS, MY_DATA_TITLE, NO_SEARCHED_TERMS, RECENT_SEARCH_TITLE, RECENT_VIEW_TITLE, SEARCH_ENTITY_DASHBOARD, SEARCH_ENTITY_PIPELINE, SEARCH_ENTITY_TABLE, SEARCH_ENTITY_TOPIC } from '../../constants/constants';

const tables = Object.values(SEARCH_ENTITY_TABLE);
const topics = Object.values(SEARCH_ENTITY_TOPIC);
const dashboards = Object.values(SEARCH_ENTITY_DASHBOARD);
const pipelines = Object.values(SEARCH_ENTITY_PIPELINE);

describe('MyData page should work', () => {
  beforeEach(() => {
    cy.goToHomePage();
  });

  const checkRecentlyViewElement = () => {
    cy.intercept(
      '/api/v1/search/query?q=*&from=0&size=*&sort_field=last_updated_timestamp&sort_order=desc&index=*'
    ).as('searchApi');
    cy.wait('@searchApi');

    cy.get('[data-testid="table-data-card"]')
      .first()
      .should('be.visible')
      .scrollIntoView();

    cy.get('[data-testid="table-link"]').first().should('be.visible').click();

    cy.get('[data-testid="inactive-link"]')
      .invoke('text')
      .then((text) => {
        cy.clickOnLogo();
        cy.get(`[data-testid="Recently Viewed-${text}"]`)
          .contains(text)
          .should('be.visible')
          .click();
        cy.get('[data-testid="inactive-link"]')
          .invoke('text')
          .then((newText) => {
            expect(newText).equal(text);
          });
        cy.clickOnLogo();
      });
  };

  const checkRecentlySearchElement = (term) => {
    searchEntity(term);
    cy.clickOnLogo();
    cy.get(`[data-testid="search-term-${term}"]`).should('be.visible').click();
    cy.get('[data-testid="searchBox"]')
      .invoke('val')
      .then((text) => {
        expect(text).equal(term);
      });
    cy.clickOnLogo();
    cy.get(
      `[data-testid="Recently-Search-${term}"] > :nth-child(1) > .tw-flex > .tw-opacity-0 > [data-testid="image"]`
    )
      .invoke('show')
      .click();
    cy.contains(NO_SEARCHED_TERMS).should('be.visible');
  };

  const followAndOwnTheEntity = (termObj) => {
    cy.intercept(
      '/api/v1/search/query?q=*&from=0&size=10&sort_order=desc&index=*'
    ).as('searchApi');
    // search for the term and redirect to the respective entity tab
    searchEntity(termObj.term);

    cy.get(`[data-testid="${termObj.entity}-tab"]`)
      .should('be.visible')
      .click();

    cy.get(`[data-testid="${termObj.entity}-tab"]`)
      .should('be.visible')
      .should('have.class', 'active');

    cy.wait('@searchApi');
    // click on the 1st result and go to entity details page and follow the entity
    cy.get('[data-testid="table-link"]').first().contains(termObj.term).as('resultLink');
    cy.wait(500); // Wait for result to load after api success
    cy.get('@resultLink').click();
    cy.get('[data-testid="follow-button"]').should('be.visible').click();

    // go to manage tab and search for logged in user and set the owner
    cy.get('[data-testid="Manage"]').should('be.visible').click();

    cy.get(
      '[data-testid="dropdown-profile"] > [data-testid="dropdown-item"] > :nth-child(1) > [data-testid="menu-button"]'
    )
      .should('be.visible')
      .click();
    cy.get('[data-testid="greeting-text"] > a > :nth-child(1)')
      .should('be.visible')
      .invoke('text')
      .then((name) => {
        cy.get('.tw-z-10').click();
        cy.get('[data-testid="owner-dropdown"]').should('be.visible').click();
        cy.get('[data-testid="dropdown-tab"]').eq(1).should('exist').click();
        cy.get('[data-testid="list-item"]').should('be.visible').click();
        cy.get('[data-testid="owner-dropdown"] > .tw-truncate')
          .invoke('text')
          .then((text) => {
            expect(text).equal(name);
          });
        cy.clickOnLogo();

        // checks newly generated feed for follow and setting owner
        cy.get('[data-testid="message-container"]')
          .first()
          .contains(`Added owner: ${name}`)
          .should('be.visible');

        cy.get('[data-testid="message-container"]')
          .eq(1)
          .scrollIntoView()
          .contains(`Started to follow ${termObj.entity.slice(0, -1)}`)
          .should('be.visible');
      });

    cy.clickOnLogo();
  };

  it('MyData Page should render properly with all the required components', () => {
    cy.get('[data-testid="data-summary-container"]').should('be.visible');
    cy.contains(RECENT_SEARCH_TITLE).should('be.visible');
    cy.contains(RECENT_VIEW_TITLE).should('be.visible');
    cy.contains(MY_DATA_TITLE).should('be.visible');
    cy.contains(FOLLOWING_TITLE).should('be.visible');

    Object.values(MYDATA_SUMMARY_OPTIONS).forEach((value) => {
      cy.get(
        `[data-testid="data-summary-container"] [data-testid="${value}-summary"]`
      ).should('be.visible');
    });
  });

  it('Recent view section and redirection should work for table entity', () => {
    visitEntityTab(MYDATA_SUMMARY_OPTIONS.tables);
    checkRecentlyViewElement();
  });

  it('Recent view section and redirection should work for topic entity', () => {
    visitEntityTab(MYDATA_SUMMARY_OPTIONS.topics);
    checkRecentlyViewElement();
  });

  it('Recent view section and redirection should work for dashboard entity', () => {
    visitEntityTab(MYDATA_SUMMARY_OPTIONS.dashboards);
    checkRecentlyViewElement();
  });

  it('Recent view section and redirection should work for pipeline entity', () => {
    visitEntityTab(MYDATA_SUMMARY_OPTIONS.pipelines);
    checkRecentlyViewElement();
  });

  it('Listing Recent search terms with redirection should work properly', () => {
    cy.contains(NO_SEARCHED_TERMS).should('be.visible');

    checkRecentlySearchElement(SEARCH_ENTITY_TABLE.table_1.term);
    checkRecentlySearchElement(SEARCH_ENTITY_TOPIC.topic_1.term);
    checkRecentlySearchElement(SEARCH_ENTITY_DASHBOARD.dashboard_1.term);
    checkRecentlySearchElement(SEARCH_ENTITY_PIPELINE.pipeline_1.term);
  });

  it('My data, following & feed section should work properly for table entity', () => {
    tables.forEach((table) => {
      followAndOwnTheEntity(table);
    });
  });

  it('My data, following & feed section should work properly for topic entity', () => {
    topics.forEach((topic) => {
      followAndOwnTheEntity(topic);
    });
  });

  it('My data, following & feed section should work properly for dashboard entity', () => {
    dashboards.forEach((dashboard) => {
      followAndOwnTheEntity(dashboard);
    });
  });

  it('My data, following & feed section should work properly for pipeline entity', () => {
    pipelines.forEach((pipeline) => {
      followAndOwnTheEntity(pipeline);
    });
  });

  it('My data and following section, CTA should work properly', () => {
    const totalCount =
      tables.length + pipelines.length + dashboards.length + topics.length;

    cy.get('[data-testid="my-data-container"]')
      .children()
      .should('have.length', 9);
    cy.get('[data-testid="following-data-container"]')
      .children()
      .should('have.length', 9);

    cy.get('[data-testid="my-data-total-count"]')
      .invoke('text')
      .then((text) => {
        expect(text).equal(`(${totalCount})`);
      });
    cy.get('[data-testid="following-data-total-count"]')
      .invoke('text')
      .then((text) => {
        expect(text).equal(`(${totalCount})`);
      });

    cy.get('[data-testid="my-data-total-count"]').should('be.visible').click();

    cy.intercept(
      '/api/v1/search/query?q=*&from=0&size=*&sort_field=last_updated_timestamp&sort_order=desc&index=*'
    ).as('searchApi');
    cy.wait('@searchApi');
    cy.get('[data-testid="table-data-card"]').first().should('be.visible');
    cy.clickOnLogo();

    cy.get('[data-testid="following-data-total-count"]')
      .should('be.visible')
      .click();

    cy.wait('@searchApi');
    cy.get('[data-testid="table-data-card"]').first().should('be.visible');
    cy.clickOnLogo();
  });
});
