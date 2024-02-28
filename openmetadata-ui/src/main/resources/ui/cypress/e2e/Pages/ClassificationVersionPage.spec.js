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

import { interceptURL, verifyResponseStatusCode } from '../../common/common';
import { visitClassificationPage } from '../../common/TagUtils';
import {
  NEW_CLASSIFICATION_FOR_VERSION_TEST,
  NEW_CLASSIFICATION_PATCH_PAYLOAD,
} from '../../constants/Version.constants';

describe(
  'Classification version page should work properly',
  { tags: 'Governance' },
  () => {
    let classificationId;

    beforeEach(() => {
      cy.login();
      interceptURL(
        'GET',
        `/api/v1/tags?fields=usageCount&parent=${NEW_CLASSIFICATION_FOR_VERSION_TEST.name}&limit=10`,
        'getTagList'
      );
      interceptURL(
        'GET',
        `/api/v1/permissions/classification/*`,
        'permissions'
      );
      interceptURL(
        'GET',
        `/api/v1/search/query?q=*%20AND%20disabled:false&index=tag_search_index*`,
        'suggestTag'
      );
      visitClassificationPage();
    });

    it('Prerequisites for classification version page tests', () => {
      const token = localStorage.getItem('oidcIdToken');

      cy.request({
        method: 'PUT',
        url: `/api/v1/classifications`,
        headers: { Authorization: `Bearer ${token}` },
        body: NEW_CLASSIFICATION_FOR_VERSION_TEST,
      }).then((response) => {
        expect(response.status).to.eq(201);

        classificationId = response.body.id;

        cy.request({
          method: 'PATCH',
          url: `/api/v1/classifications/${classificationId}`,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json-patch+json',
          },
          body: NEW_CLASSIFICATION_PATCH_PAYLOAD,
        }).then((response) => {
          expect(response.status).to.eq(200);
        });
      });
    });

    it('Classification version page should display all the changes properly', () => {
      cy.get('[data-testid="data-summary-container"]')
        .contains(NEW_CLASSIFICATION_FOR_VERSION_TEST.displayName)
        .click({ waitForAnimations: true })
        .parent()
        .should('have.class', 'activeCategory');

      interceptURL(
        'GET',
        `/api/v1/classifications/name/${NEW_CLASSIFICATION_FOR_VERSION_TEST.name}`,
        `getClassificationDetails`
      );
      interceptURL(
        'GET',
        `/api/v1/classifications/${classificationId}/versions`,
        'getVersionsList'
      );
      interceptURL(
        'GET',
        `/api/v1/classifications/${classificationId}/versions/0.2`,
        'getSelectedVersionDetails'
      );

      cy.get('[data-testid="version-button"]').contains('0.2').click();

      verifyResponseStatusCode(`@getClassificationDetails`, 200);
      verifyResponseStatusCode('@getVersionsList', 200);
      verifyResponseStatusCode('@getSelectedVersionDetails', 200);

      cy.get(
        `[data-testid="description"] [data-testid="diff-added"]`
      ).scrollIntoView();

      cy.get(`[data-testid="description"] [data-testid="diff-added"]`).should(
        'be.visible'
      );

      cy.get('[data-testid="mutually-exclusive-container"]').as(
        'mutuallyExclusiveContainer'
      );

      cy.get('[data-testid="version-button"]').click();

      cy.get('[data-testid="manage-button"]').click({
        waitForAnimations: true,
      });

      interceptURL(
        'PATCH',
        `/api/v1/classifications/${classificationId}`,
        `patchClassification`
      );

      cy.get('[data-testid="enable-disable"]').click();

      verifyResponseStatusCode(`@patchClassification`, 200);

      interceptURL(
        'GET',
        `/api/v1/classifications/name/${NEW_CLASSIFICATION_FOR_VERSION_TEST.name}`,
        `getClassificationDetails`
      );
      interceptURL(
        'GET',
        `/api/v1/classifications/${classificationId}/versions`,
        'getVersionsList'
      );

      cy.get('[data-testid="version-button"]').contains('0.2').click();

      verifyResponseStatusCode(`@getClassificationDetails`, 200);
      verifyResponseStatusCode('@getVersionsList', 200);
      verifyResponseStatusCode('@getSelectedVersionDetails', 200);

      cy.get('[data-testid="disabled"]').should('be.visible');

      cy.get('[data-testid="version-button"]').contains('0.2').click();

      cy.get('[data-testid="manage-button"]').click({
        waitForAnimations: true,
      });

      cy.get('[data-testid="enable-disable"]').click();

      verifyResponseStatusCode(`@patchClassification`, 200);

      interceptURL(
        'GET',
        `/api/v1/classifications/name/${NEW_CLASSIFICATION_FOR_VERSION_TEST.name}`,
        `getClassificationDetails`
      );
      interceptURL(
        'GET',
        `/api/v1/classifications/${classificationId}/versions`,
        'getVersionsList'
      );

      cy.get('[data-testid="version-button"]').contains('0.2').click();

      verifyResponseStatusCode(`@getClassificationDetails`, 200);
      verifyResponseStatusCode('@getVersionsList', 200);
      verifyResponseStatusCode('@getSelectedVersionDetails', 200);

      cy.get(
        `[data-testid="classification-${NEW_CLASSIFICATION_FOR_VERSION_TEST.name}"]`
      ).should('not.contain', 'disabled');
    });
  }
);
