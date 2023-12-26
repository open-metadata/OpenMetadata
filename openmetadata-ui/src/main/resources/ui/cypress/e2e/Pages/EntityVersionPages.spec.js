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

import { isEmpty } from 'lodash';
import {
  addOwner,
  addTier,
  deleteEntity,
  interceptURL,
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

describe('Version page tests for data assets', () => {
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;
      cy.request({
        method: 'PUT',
        url: `/api/v1/domains`,
        headers: { Authorization: `Bearer ${token}` },
        body: DOMAIN_CREATION_DETAILS,
      }).then((response) => {
        domainId = response.body.id;
      });
    });
  });

  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;
      cy.request({
        method: 'DELETE',
        url: `/api/v1/domains/name/${DOMAIN_CREATION_DETAILS.name}`,
        headers: { Authorization: `Bearer ${token}` },
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

        before(() => {
          cy.login();
          cy.getAllLocalStorage().then((data) => {
            const token = Object.values(data)[0].oidcIdToken;
            cy.request({
              method: 'PUT',
              url: `/api/v1/${entityDetails.entity}`,
              headers: { Authorization: `Bearer ${token}` },
              body: entityDetails.entityCreationDetails,
            }).then((response) => {
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
              });
            });
          });
        });

        beforeEach(() => {
          cy.login();
        });

        it(`${entityType} version page should show description, tag and child field name changes properly`, () => {
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

          // Check if child field names are displayed properly on version page
          if (!isEmpty(entityDetails.childFieldNameToCheck)) {
            cy.get(
              `[${entityDetails.childSelector}="${entityDetails.childFieldNameToCheck}"]`
            ).should('contain', entityDetails.childFieldNameToCheck);
          }

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

        if (entityType === 'Table') {
          it(`${entityType} version page should show column display name changes properly`, () => {
            visitEntityDetailsPage({
              term: entityDetails.name,
              serviceName: entityDetails.serviceName,
              entity: entityDetails.entity,
            });

            cy.get('[data-testid="version-button"]').as('versionButton');

            cy.get('@versionButton').contains('0.2');

            cy.get(
              `[data-row-key$="${entityDetails.childFieldNameToCheck}"] [data-testid="edit-displayName-button"]`
            ).click({ waitForAnimations: true });

            cy.get('#displayName')
              .clear()
              .type(entityDetails.columnDisplayNameToUpdate);

            interceptURL('PATCH', `/api/v1/tables/*`, `updateColumnName`);

            cy.get('.ant-modal-footer [data-testid="save-button"]').click();

            verifyResponseStatusCode(`@updateColumnName`, 200);

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
              `/api/v1/${entityDetails.entity}/${entityId}/versions/0.2`,
              'getSelectedVersionDetails'
            );

            cy.get('@versionButton').contains('0.2').click();

            verifyResponseStatusCode(`@get${entityType}Details`, 200);
            verifyResponseStatusCode('@getVersionsList', 200);
            verifyResponseStatusCode('@getSelectedVersionDetails', 200);

            cy.get(
              `[data-row-key$="${entityDetails.childFieldNameToCheck}"] [data-testid="diff-added"]`
            ).should('contain', entityDetails.columnDisplayNameToUpdate);
          });
        }

        it(`${entityType} version page should show owner changes properly`, () => {
          visitEntityDetailsPage({
            term: entityDetails.name,
            serviceName: entityDetails.serviceName,
            entity: entityDetails.entity,
          });

          cy.get('[data-testid="version-button"]').as('versionButton');

          cy.get('@versionButton').contains('0.2');

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
            `/api/v1/${entityDetails.entity}/${entityId}/versions/0.2`,
            'getSelectedVersionDetails'
          );

          cy.get('@versionButton').contains('0.2').click();

          verifyResponseStatusCode(`@get${entityType}Details`, 200);
          verifyResponseStatusCode('@getVersionsList', 200);
          verifyResponseStatusCode('@getSelectedVersionDetails', 200);

          cy.get('[data-testid="owner-link"] > [data-testid="diff-added"]')
            .scrollIntoView()
            .should('be.visible');
        });

        it(`${entityType} version page should show tier changes properly`, () => {
          visitEntityDetailsPage({
            term: entityDetails.name,
            serviceName: entityDetails.serviceName,
            entity: entityDetails.entity,
          });

          cy.get('[data-testid="version-button"]').as('versionButton');

          cy.get('@versionButton').contains('0.2');

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
            `/api/v1/${entityDetails.entity}/${entityId}/versions/0.2`,
            'getSelectedVersionDetails'
          );

          cy.get('@versionButton').contains('0.2').click();

          verifyResponseStatusCode(`@get${entityType}Details`, 200);
          verifyResponseStatusCode('@getVersionsList', 200);
          verifyResponseStatusCode('@getSelectedVersionDetails', 200);

          cy.get('[data-testid="Tier"] > [data-testid="diff-added"]')
            .scrollIntoView()
            .should('be.visible');
        });

        it(`${entityType} version page should show changes after soft deleted`, () => {
          deleteEntity(
            entityDetails.name,
            entityDetails.serviceName,
            entityDetails.entity,
            successMessageEntityName,
            'soft'
          );

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
            `/api/v1/${entityDetails.entity}/${entityId}/versions/0.3`,
            'getSelectedVersionDetails'
          );

          cy.get('[data-testid="version-button"]').contains('0.3').click();

          verifyResponseStatusCode(`@get${entityType}Details`, 200);
          verifyResponseStatusCode('@getVersionsList', 200);
          verifyResponseStatusCode('@getSelectedVersionDetails', 200);

          // Deleted badge should be visible
          cy.get('[data-testid="deleted-badge"]')
            .scrollIntoView()
            .should('be.visible');
        });

        after(() => {
          cy.getAllLocalStorage().then((data) => {
            const token = Object.values(data)[0].oidcIdToken;
            cy.request({
              method: 'DELETE',
              url: `/api/v1/${entityDetails.entity}/${entityId}`,
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
          });
        });
      });
    }
  );
});
