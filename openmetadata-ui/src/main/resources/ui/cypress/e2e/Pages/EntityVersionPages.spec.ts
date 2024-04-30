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

import { isEmpty } from 'lodash';
import {
  deleteEntity,
  interceptURL,
  verifyResponseStatusCode,
} from '../../common/common';
import { visitEntityDetailsPage } from '../../common/Utils/Entity';
import { getToken } from '../../common/Utils/LocalStorage';
import { addOwner } from '../../common/Utils/Owner';
import { addTier } from '../../common/Utils/Tier';
import { visitEntityDetailsVersionPage } from '../../common/VersionUtils';
import { DOMAIN_CREATION_DETAILS } from '../../constants/EntityConstant';
import {
  ENTITY_DETAILS_FOR_VERSION_TEST,
  OWNER_DETAILS,
  TIER,
} from '../../constants/Version.constants';

describe('Version page tests for data assets', { tags: 'DataAssets' }, () => {
  const data = {
    user: { id: '', displayName: '' },
    domain: { id: '' },
  };
  before(() => {
    cy.login();
    cy.getAllLocalStorage().then((responseData) => {
      const token = getToken(responseData);

      // Create user
      cy.request({
        method: 'POST',
        url: `/api/v1/users/signup`,
        headers: { Authorization: `Bearer ${token}` },
        body: OWNER_DETAILS,
      }).then((response) => {
        data.user = response.body;
      });

      cy.request({
        method: 'PUT',
        url: `/api/v1/domains`,
        headers: { Authorization: `Bearer ${token}` },
        body: DOMAIN_CREATION_DETAILS,
      }).then((response) => {
        data.domain = response.body;
      });
    });
  });

  after(() => {
    cy.login();
    cy.getAllLocalStorage().then((responseData) => {
      const token = getToken(responseData);

      // Delete created user
      cy.request({
        method: 'DELETE',
        url: `/api/v1/users/${data.user.id}?hardDelete=true&recursive=false`,
        headers: { Authorization: `Bearer ${token}` },
      });

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
        let entityId: string;
        let entityFQN: string;

        before(() => {
          cy.login();
          cy.getAllLocalStorage().then((responseData) => {
            const token = getToken(responseData);
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
                      id: data.domain.id,
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

          addOwner(data.user.displayName);

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

          addTier(TIER);

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
          visitEntityDetailsPage({
            term: entityDetails.name,
            serviceName: entityDetails.serviceName,
            entity: entityDetails.entity,
          });
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
            const token = getToken(data);
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
