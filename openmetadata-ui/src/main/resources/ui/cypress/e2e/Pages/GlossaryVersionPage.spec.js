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
// eslint-disable-next-line spaced-comment
/// <reference types="Cypress" />

import {
  addOwner,
  interceptURL,
  removeOwner,
  verifyResponseStatusCode,
} from '../../common/common';
import {
  addReviewer,
  deleteGlossary,
  removeReviewer,
  visitGlossaryPage,
} from '../../common/GlossaryUtils';
import {
  GLOSSARY_FOR_VERSION_TEST,
  GLOSSARY_PATCH_PAYLOAD,
  GLOSSARY_TERM_FOR_VERSION_TEST1,
  GLOSSARY_TERM_FOR_VERSION_TEST2,
  GLOSSARY_TERM_NAME_FOR_VERSION_TEST1,
  GLOSSARY_TERM_NAME_FOR_VERSION_TEST2,
  GLOSSARY_TERM_PATCH_PAYLOAD2,
  OWNER,
  REVIEWER,
} from '../../constants/Version.constants';

describe('Glossary and glossary term version pages should work properly', () => {
  let glossaryId;
  let glossaryTerm1Id;
  let glossaryTerm2Id;

  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;
      // Create Glossary
      cy.request({
        method: 'PUT',
        url: `/api/v1/glossaries`,
        headers: { Authorization: `Bearer ${token}` },
        body: GLOSSARY_FOR_VERSION_TEST,
      }).then((response) => {
        glossaryId = response.body.id;

        cy.request({
          method: 'PATCH',
          url: `/api/v1/glossaries/${glossaryId}`,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json-patch+json',
          },
          body: GLOSSARY_PATCH_PAYLOAD,
        });
      });

      // Create First Glossary Term
      cy.request({
        method: 'PUT',
        url: `/api/v1/glossaryTerms`,
        headers: { Authorization: `Bearer ${token}` },
        body: GLOSSARY_TERM_FOR_VERSION_TEST1,
      }).then((response) => {
        glossaryTerm1Id = response.body.id;
      });

      // Create Second Glossary Term
      cy.request({
        method: 'PUT',
        url: `/api/v1/glossaryTerms`,
        headers: { Authorization: `Bearer ${token}` },
        body: GLOSSARY_TERM_FOR_VERSION_TEST2,
      }).then((response) => {
        glossaryTerm2Id = response.body.id;

        const relatedTermsPatchValue = {
          op: 'add',
          path: '/relatedTerms/0',
          value: {
            id: glossaryTerm1Id,
            type: 'glossaryTerm',
            displayName: GLOSSARY_TERM_NAME_FOR_VERSION_TEST1,
            name: GLOSSARY_TERM_NAME_FOR_VERSION_TEST1,
          },
        };

        cy.request({
          method: 'PATCH',
          url: `/api/v1/glossaryTerms/${glossaryTerm2Id}`,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json-patch+json',
          },
          body: [...GLOSSARY_TERM_PATCH_PAYLOAD2, relatedTermsPatchValue],
        });
      });
    });
  });

  beforeEach(() => {
    cy.login();
    interceptURL('GET', `/api/v1/glossaries?fields=*`, 'getGlossaryDetails');
    interceptURL('GET', '/api/v1/glossaryTerms?glossary=*', 'getGlossaryTerms');
    visitGlossaryPage();
  });

  it('Glossary version page should display the version changes properly', () => {
    cy.get(`[data-menu-id*=${GLOSSARY_FOR_VERSION_TEST.displayName}]`).click();

    verifyResponseStatusCode('@getGlossaryDetails', 200);
    verifyResponseStatusCode('@getGlossaryTerms', 200);

    cy.get('[data-testid="version-button"]').contains('0.2').click();

    cy.get(`[data-testid="diff-added"]`).scrollIntoView().should('be.visible');

    cy.get(`.diff-added [data-testid="tag-PersonalData.SpecialCategory"]`)
      .scrollIntoView()
      .should('be.visible');

    cy.get(`.diff-added [data-testid="tag-PII.Sensitive"]`)
      .scrollIntoView()
      .should('be.visible');
  });

  it('Glossary version page should display the owner and reviewer changes properly', () => {
    cy.get(`[data-menu-id*=${GLOSSARY_FOR_VERSION_TEST.displayName}]`).click();

    verifyResponseStatusCode('@getGlossaryDetails', 200);
    verifyResponseStatusCode('@getGlossaryTerms', 200);

    cy.get('[data-testid="version-button"]').contains('0.2');

    addOwner(OWNER, 'glossaries', true, true);

    interceptURL('GET', `/api/v1/glossaries/*/versions`, 'getVersionsList');
    interceptURL(
      'GET',
      `/api/v1/glossaries/*/versions/0.2`,
      'getSelectedVersionDetails'
    );

    cy.get('[data-testid="version-button"]').contains('0.2').click();

    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get('[data-testid="glossary-owner-name"] [data-testid="diff-added"]')
      .scrollIntoView()
      .should('be.visible');

    cy.get('[data-testid="version-button"]').contains('0.2').click();

    verifyResponseStatusCode('@getGlossaryDetails', 200);
    verifyResponseStatusCode('@getGlossaryTerms', 200);

    removeOwner('glossaries', true);

    addReviewer(REVIEWER, 'glossaries');

    interceptURL(
      'GET',
      `/api/v1/glossaries/*/versions/0.2`,
      'getSelectedVersionDetails'
    );

    cy.get('[data-testid="version-button"]').contains('0.2').click();

    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get('[data-testid="glossary-reviewer"] [data-testid="diff-added"]')
      .scrollIntoView()
      .should('be.visible');

    cy.get('[data-testid="version-button"]').contains('0.2').click();

    verifyResponseStatusCode('@getGlossaryDetails', 200);
    verifyResponseStatusCode('@getGlossaryTerms', 200);

    removeReviewer('glossaries');
  });

  it('Glossary term version page should display version changes properly', () => {
    cy.get(`[data-menu-id*=${GLOSSARY_FOR_VERSION_TEST.displayName}]`).click();

    interceptURL(
      'GET',
      `/api/v1/glossaryTerms/name/*?fields=*`,
      'getGlossaryTermDetails'
    );
    interceptURL(
      'GET',
      `/api/v1/glossaryTerms?parent=*&limit=*&fields=*`,
      'getGlossaryTermParents'
    );
    interceptURL(
      'GET',
      `/api/v1/glossaryTerms?parent=*&limit=*`,
      'getChildGlossaryTerms'
    );

    cy.get(`[data-testid="${GLOSSARY_TERM_NAME_FOR_VERSION_TEST2}"]`).click();

    verifyResponseStatusCode('@getGlossaryTermDetails', 200);
    verifyResponseStatusCode('@getGlossaryTermParents', 200);
    verifyResponseStatusCode('@getChildGlossaryTerms', 200);

    cy.get('[data-testid="version-button"]').contains('0.2').click();

    cy.get(`[data-testid="diff-added"]`).scrollIntoView().should('be.visible');

    cy.get(`.diff-added [data-testid="tag-PersonalData.SpecialCategory"]`)
      .scrollIntoView()
      .should('be.visible');

    cy.get(`.diff-added [data-testid="tag-PII.Sensitive"]`)
      .scrollIntoView()
      .should('be.visible');

    cy.get('[data-testid="test-synonym"].diff-added')
      .scrollIntoView()
      .should('be.visible');

    cy.get(`[data-testid="${GLOSSARY_TERM_NAME_FOR_VERSION_TEST1}"].diff-added`)
      .scrollIntoView()
      .should('be.visible');

    cy.get('.diff-added [data-testid="reference-link-reference1"]')
      .scrollIntoView()
      .should('be.visible');
  });

  it('Glossary term version page should display owner and reviewer changes properly', () => {
    cy.get(`[data-menu-id*=${GLOSSARY_FOR_VERSION_TEST.displayName}]`).click();

    interceptURL(
      'GET',
      `/api/v1/glossaryTerms/name/*?fields=*`,
      'getGlossaryTermDetails'
    );
    interceptURL(
      'GET',
      `/api/v1/glossaryTerms?parent=*&limit=*&fields=*`,
      'getGlossaryTermParents'
    );
    interceptURL(
      'GET',
      `/api/v1/glossaryTerms?parent=*&limit=*`,
      'getChildGlossaryTerms'
    );

    cy.get(`[data-testid="${GLOSSARY_TERM_NAME_FOR_VERSION_TEST2}"]`).click();

    verifyResponseStatusCode('@getGlossaryTermDetails', 200);
    verifyResponseStatusCode('@getGlossaryTermParents', 200);
    verifyResponseStatusCode('@getChildGlossaryTerms', 200);

    cy.get('[data-testid="version-button"]').contains('0.2');

    addOwner(OWNER, 'glossaryTerms', true, true);

    interceptURL('GET', `/api/v1/glossaryTerms/*/versions`, 'getVersionsList');
    interceptURL(
      'GET',
      `/api/v1/glossaryTerms/*/versions/0.2`,
      'getSelectedVersionDetails'
    );

    cy.get('[data-testid="version-button"]').contains('0.2').click();

    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get('[data-testid="glossary-owner-name"] [data-testid="diff-added"]')
      .scrollIntoView()
      .should('be.visible');

    cy.get('[data-testid="version-button"]').contains('0.2').click();

    verifyResponseStatusCode('@getGlossaryTermParents', 200);
    verifyResponseStatusCode('@getChildGlossaryTerms', 200);

    removeOwner('glossaryTerms', true);

    addReviewer(REVIEWER, 'glossaryTerms');

    interceptURL(
      'GET',
      `/api/v1/glossaryTerms/*/versions/0.2`,
      'getSelectedVersionDetails'
    );

    cy.get('[data-testid="version-button"]').contains('0.2').click();

    verifyResponseStatusCode('@getVersionsList', 200);
    verifyResponseStatusCode('@getSelectedVersionDetails', 200);

    cy.get('[data-testid="glossary-reviewer"] [data-testid="diff-added"]')
      .scrollIntoView()
      .should('be.visible');

    cy.get('[data-testid="version-button"]').contains('0.2').click();

    verifyResponseStatusCode('@getGlossaryTermParents', 200);
    verifyResponseStatusCode('@getChildGlossaryTerms', 200);

    removeReviewer('glossaryTerms');
  });

  it('Cleanup for glossary and glossary term version page tests', () => {
    deleteGlossary(GLOSSARY_FOR_VERSION_TEST.name);
  });
});
