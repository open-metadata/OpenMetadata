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
import { FOLLOWING_TITLE, MYDATA_SUMMARY_OPTIONS, MY_DATA_TITLE, NO_SEARCHED_TERMS, RECENT_SEARCH_TITLE, RECENT_VIEW_TITLE, SEARCH_TERMS } from '../../constants/constants';

describe('MyData page should work', () => {
  beforeEach(() => {
    cy.goToHomePage();
  });

  const checkRecentlyViewElement = (index, tab) => {
    visitEntityTab(tab);
    cy.wait(100); // to prevent from flicky behaviour, if page is not loaded it will wait for 100ms else it will continue testing
    cy.get('[data-testid="table-data-card"]').eq(index).should('be.visible');
    cy.get('[data-testid="table-link"]').eq(index).should('be.visible').click();

    cy.get('[data-testid="inactive-link"]')
      .invoke('text')
      .then((text) => {
        cy.clickOnLogo();
        cy.get(`[title="${text}"]`).first().should('be.visible').click();
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
    // search for the term and redirect to the respective entity tab
    searchEntity(termObj.term);
    cy.get(`[data-testid="${termObj.entity}-tab"]`)
      .should('be.visible')
      .click();
    cy.get(`[data-testid="${termObj.entity}-tab"]`)
      .should('be.visible')
      .should('have.class', 'active')
      .click();

    // click on the 1st result and go to entity details page and follow the entity
    cy.get('[data-testid="table-data-card"]').contains(termObj.term).should('be.visible').click();
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
        cy.get('[data-testid="searchInputText"]').type(name);
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

  it('onClick of table should redirect to tables tab in explore page', () => {
    visitEntityTab(MYDATA_SUMMARY_OPTIONS.tables);
  });

  it('onClick of topics should redirect to topics tab in explore page', () => {
    visitEntityTab(MYDATA_SUMMARY_OPTIONS.topics);
  });

  it('onClick of dashboards should redirect to dashboards tab in explore page', () => {
    visitEntityTab(MYDATA_SUMMARY_OPTIONS.dashboards);
  });

  it('onClick of pipelines should redirect to pipelines tab in explore page', () => {
    visitEntityTab(MYDATA_SUMMARY_OPTIONS.pipelines);
  });

  it('Listing entity in Recent views section with redirection should work properly', () => {
    // checking for table entity
    checkRecentlyViewElement(0, MYDATA_SUMMARY_OPTIONS.tables);

    // checking for topic entity
    checkRecentlyViewElement(0, MYDATA_SUMMARY_OPTIONS.topics);

    // checking for dashboard entity
    checkRecentlyViewElement(0, MYDATA_SUMMARY_OPTIONS.dashboards);

    // checking for pipeline entity
    checkRecentlyViewElement(0, MYDATA_SUMMARY_OPTIONS.pipelines);
  });

  it('Listing Recent search terms with redirection should work properly', () => {
    cy.contains(NO_SEARCHED_TERMS).should('be.visible');

    checkRecentlySearchElement(SEARCH_TERMS.eta_predictions_performance.term);
    checkRecentlySearchElement(SEARCH_TERMS.fact_session.term);
    checkRecentlySearchElement(SEARCH_TERMS.hive_etl.term);
    checkRecentlySearchElement(SEARCH_TERMS.sales.term);
  });

  it('My data, following & feed section should work properly', () => {
    const termArr = Object.values(SEARCH_TERMS);

    termArr.forEach((term) => {
      followAndOwnTheEntity(term);
    });

    cy.get('[data-testid="my-data-container"]')
      .children()
      .should('have.length', 9);
    cy.get('[data-testid="following-data-container"]')
      .children()
      .should('have.length', 9);

    cy.clickOnLogo();
    cy.get('[data-testid="my-data-total-count"]')
      .invoke('text')
      .then((text) => {
        expect(text).equal(`(${termArr.length})`);
      });

    cy.get('[data-testid="my-data-total-count"]').click();
    cy.get('[data-testid="table-data-card"]').first().should('be.visible');
    cy.clickOnLogo();

    cy.get('[data-testid="following-data-total-count"]')
      .invoke('text')
      .then((text) => {
        expect(text).equal(`(${termArr.length})`);
      });

    cy.get('[data-testid="following-data-total-count"]').click();
    cy.get('[data-testid="table-data-card"]').first().should('be.visible');
    cy.clickOnLogo();
  });
});
