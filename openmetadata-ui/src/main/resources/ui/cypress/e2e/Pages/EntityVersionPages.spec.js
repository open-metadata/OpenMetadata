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
  addTier,
  deleteEntity,
  interceptURL,
  removeOwner,
  removeTier,
  verifyResponseStatusCode,
  visitEntityDetailsPage,
} from '../../common/common';
import { visitEntityDetailsVersionPage } from '../../common/VersionUtils';
import {
  DOMAIN_CREATION_DETAILS,
  ENTITY_DETAILS_FOR_VERSION_TEST,
  OWNER,
  TIER,
} from '../../constants/Version.constants';

let domainId;

describe('Common prerequisite for entity version test', () => {
  beforeEach(() => {
    cy.login();
  });

  it('Domain creation for entity version test', () => {
    const token = localStorage.getItem('oidcIdToken');

    cy.request({
      method: 'PUT',
      url: `/api/v1/domains`,
      headers: { Authorization: `Bearer ${token}` },
      body: DOMAIN_CREATION_DETAILS,
    }).then((response) => {
      expect(response.status).to.eq(201);

      domainId = response.body.id;
    });
  });
});

Object.entries(ENTITY_DETAILS_FOR_VERSION_TEST).map(
  ([entityType, entityDetails]) => {
    describe(`${entityType} version page should work properly`, () => {
      const successMessageEntityName =
        entityType === 'ML Model' ? 'Mlmodel' : entityType;
      let entityId;
      let entityFQN;

      beforeEach(() => {
        cy.login();
      });

      it(`Prerequisite for ${entityType} version page test`, () => {
        const token = localStorage.getItem('oidcIdToken');

        cy.request({
          method: 'PUT',
          url: `/api/v1/${entityDetails.entity}`,
          headers: { Authorization: `Bearer ${token}` },
          body: entityDetails.entityCreationDetails,
        }).then((response) => {
          expect(response.status).to.eq(201);

          entityId = response.body.id;
          entityFQN = response.body.fullyQualifiedName;

          cy.request({
            method: 'PATCH',
            url: `/api/v1/${entityDetails.entity}/${entityId}`,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json-patch+json',
            },
            body: [
              ...entityDetails.entityPatchPayload,
              {
                op: 'add',
                path: '/domain',
                value: {
                  id: domainId,
                  type: 'domain',
                  name: DOMAIN_CREATION_DETAILS.name,
                  description: DOMAIN_CREATION_DETAILS.description,
                },
              },
            ],
          }).then((response) => {
            expect(response.status).to.eq(200);
          });
        });
      });

      it(`${entityType} version page should show description and tag changes properly`, () => {
        visitEntityDetailsVersionPage(
          entityDetails,
          entityId,
          entityFQN,
          '0.2'
        );

        cy.get(`[data-testid="domain-link"] [data-testid="diff-added"]`)
          .scrollIntoView()
          .should('be.visible');

        cy.get(
          `[data-testid="asset-description-container"] [data-testid="diff-added"]`
        )
          .scrollIntoView()
          .should('be.visible');

        cy.get(
          `[data-testid="entity-right-panel"] .diff-added [data-testid="tag-PersonalData.SpecialCategory"]`
        )
          .scrollIntoView()
          .should('be.visible');

        if (entityDetails.isChildrenExist) {
          cy.get(
            `[${entityDetails.childSelector}="${entityDetails.updatedTagEntityChildName}"] .diff-added [data-testid="tag-PersonalData.Personal"]`
          )
            .scrollIntoView()
            .should('be.visible');

          cy.get(
            `[${entityDetails.childSelector}="${entityDetails.updatedTagEntityChildName}"] .diff-added [data-testid="tag-PII.Sensitive"]`
          )
            .scrollIntoView()
            .should('be.visible');

          cy.get(`[data-testid="diff-removed"]`)
            .contains(entityDetails.entityChildRemovedDescription)
            .scrollIntoView()
            .should('be.visible');

          cy.get(`[data-testid="diff-added"]`)
            .contains(entityDetails.entityChildAddedDescription)
            .scrollIntoView()
            .should('be.visible');
        }
      });

      it(`${entityType} version page should show removed tags changes properly`, () => {
        visitEntityDetailsPage({
          term: entityDetails.name,
          serviceName: entityDetails.serviceName,
          entity: entityDetails.entity,
          entityType: entityType,
        });

        cy.get(
          '[data-testid="entity-right-panel"]  [data-testid="edit-button"]'
        ).click();

        cy.get(
          '[data-testid="selected-tag-PersonalData.SpecialCategory"] [data-testid="remove-tags"]'
        ).click();

        interceptURL(
          'PATCH',
          `/api/v1/${entityDetails.entity}/${entityId}`,
          `patch${entityType}`
        );

        cy.get('[data-testid="saveAssociatedTag"]').click();

        verifyResponseStatusCode(`@patch${entityType}`, 200);

        cy.get('[data-testid="version-button"]').contains('0.3').click();

        cy.get(
          `[data-testid="entity-right-panel"] .diff-removed [data-testid="tag-PersonalData.SpecialCategory"]`
        )
          .scrollIntoView()
          .should('be.visible');
      });

      it(`${entityType} version page should show owner changes properly`, () => {
        visitEntityDetailsPage({
          term: entityDetails.name,
          serviceName: entityDetails.serviceName,
          entity: entityDetails.entity,
          entityType: entityType,
        });

        cy.get('[data-testid="version-button"]').as('versionButton');

        cy.get('@versionButton').contains('0.3');

        addOwner(OWNER, entityDetails.entity);

        interceptURL(
          'GET',
          `/api/v1/${entityDetails.entity}/name/${entityFQN}?*include=all`,
          `get${entityType}Details`
        );
        interceptURL(
          'GET',
          `/api/v1/${entityDetails.entity}/${entityId}/versions`,
          'getVersionsList'
        );
        interceptURL(
          'GET',
          `/api/v1/${entityDetails.entity}/${entityId}/versions/0.4`,
          'getSelectedVersionDetails'
        );

        cy.get('@versionButton').contains('0.4').click();

        verifyResponseStatusCode(`@get${entityType}Details`, 200);
        verifyResponseStatusCode('@getVersionsList', 200);
        verifyResponseStatusCode('@getSelectedVersionDetails', 200);

        cy.get(`[data-testid="diff-added`)
          .scrollIntoView()
          .should('be.visible');

        cy.get('@versionButton').contains('0.4').click();

        removeOwner(entityDetails.entity);

        interceptURL(
          'GET',
          `/api/v1/${entityDetails.entity}/${entityId}/versions/0.5`,
          'getSelectedVersionDetails'
        );

        cy.get('@versionButton').contains('0.5').click();

        verifyResponseStatusCode(`@get${entityType}Details`, 200);
        verifyResponseStatusCode('@getVersionsList', 200);
        verifyResponseStatusCode('@getSelectedVersionDetails', 200);

        cy.get(`[data-testid="diff-removed"]`)
          .scrollIntoView()
          .should('be.visible');
      });

      it(`${entityType} version page should show tier changes properly`, () => {
        visitEntityDetailsPage({
          term: entityDetails.name,
          serviceName: entityDetails.serviceName,
          entity: entityDetails.entity,
          entityType: entityType,
        });

        cy.get('[data-testid="version-button"]').as('versionButton');

        cy.get('@versionButton').contains('0.5');

        addTier(TIER, entityDetails.entity);

        interceptURL(
          'GET',
          `/api/v1/${entityDetails.entity}/name/${entityFQN}?*include=all`,
          `get${entityType}Details`
        );
        interceptURL(
          'GET',
          `/api/v1/${entityDetails.entity}/${entityId}/versions`,
          'getVersionsList'
        );
        interceptURL(
          'GET',
          `/api/v1/${entityDetails.entity}/${entityId}/versions/0.6`,
          'getSelectedVersionDetails'
        );

        cy.get('@versionButton').contains('0.6').click();

        verifyResponseStatusCode(`@get${entityType}Details`, 200);
        verifyResponseStatusCode('@getVersionsList', 200);
        verifyResponseStatusCode('@getSelectedVersionDetails', 200);

        cy.get(`[data-testid="diff-added"]`)
          .scrollIntoView()
          .should('be.visible');

        cy.get('@versionButton').contains('0.6').click();

        removeTier(entityDetails.entity);

        interceptURL(
          'GET',
          `/api/v1/${entityDetails.entity}/${entityId}/versions/0.7`,
          'getSelectedVersionDetails'
        );

        cy.get('@versionButton').contains('0.7').click();

        verifyResponseStatusCode(`@get${entityType}Details`, 200);
        verifyResponseStatusCode('@getVersionsList', 200);
        verifyResponseStatusCode('@getSelectedVersionDetails', 200);

        cy.get(`[data-testid="diff-removed"]`)
          .scrollIntoView()
          .should('be.visible');
      });

      it(`Cleanup for ${entityType} version page test`, () => {
        deleteEntity(
          entityDetails.name,
          entityDetails.serviceName,
          entityDetails.entity,
          entityType,
          successMessageEntityName
        );
      });
    });
  }
);

describe('Common cleanup for entity version test', () => {
  beforeEach(() => {
    cy.login();
  });

  it('Domain deletion for entity version test', () => {
    const token = localStorage.getItem('oidcIdToken');

    cy.request({
      method: 'DELETE',
      url: `/api/v1/domains/name/${DOMAIN_CREATION_DETAILS.name}`,
      headers: { Authorization: `Bearer ${token}` },
    }).then((response) => {
      expect(response.status).to.eq(200);
    });
  });
});
