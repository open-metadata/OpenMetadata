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
import {
  addAssetsToDataProduct,
  addAssetsToDomain,
  createDataProducts,
  createDomain,
  deleteDomain,
  removeAssets,
  removeAssetsFromDataProduct,
  removeAssetsFromDomain,
  renameDomain,
  updateAssets,
  updateDomainDetails,
  verifyDomain,
} from '../../common/DomainUtils';
import { DOMAIN_1, DOMAIN_2, DOMAIN_3 } from '../../constants/constants';

describe('Domain page should work properly', () => {
  beforeEach(() => {
    cy.login();

    cy.sidebarClick('app-bar-item-domain');
  });

  it('Create new domain flow should work properly', () => {
    createDomain(DOMAIN_1, true);
    createDomain(DOMAIN_2, false);
  });

  it('Verify domain after creation', () => {
    verifyDomain(DOMAIN_1);
    verifyDomain(DOMAIN_2);
  });

  it('Add assets to domain using asset selection modal should work properly', () => {
    addAssetsToDomain(DOMAIN_2);
  });

  it('Add assets to domain having space using asset selection modal should work properly', () => {
    createDomain(DOMAIN_3, false);
    addAssetsToDomain(DOMAIN_3);
  });

  it('Create new data product should work properly', () => {
    DOMAIN_1.dataProducts.forEach((dataProduct) => {
      createDataProducts(dataProduct, DOMAIN_1);
      cy.sidebarClick('app-bar-item-domain');
    });
  });

  it('Add data product assets using asset selection modal should work properly', () => {
    DOMAIN_2.dataProducts.forEach((dp) => {
      createDataProducts(dp, DOMAIN_2);
      cy.sidebarClick('app-bar-item-domain');
    });

    addAssetsToDataProduct(DOMAIN_2.dataProducts[0], DOMAIN_2);
  });

  it('Add data product assets using asset selection modal with separate domain and dp having space', () => {
    DOMAIN_3.dataProducts.forEach((dp) => {
      createDataProducts(dp, DOMAIN_3);
      cy.sidebarClick('app-bar-item-domain');
    });

    addAssetsToDataProduct(DOMAIN_3.dataProducts[0], DOMAIN_3);
  });

  it('Switch domain from navbar and check domain query call warp in quotes', () => {
    cy.get('[data-testid="domain-dropdown"]').should('be.visible').click();

    cy.get(
      `[data-menu-id*="${DOMAIN_3.name}"] > .ant-dropdown-menu-title-content`
    )
      .should('be.visible')
      .click();

    interceptURL(
      'GET',
      '/api/v1/search/query?q=%28domain.fullyQualifiedName%3A%22Cypress%20Space%22%29*',
      'tableSearchQuery'
    );

    cy.sidebarClick('app-bar-item-explore');

    verifyResponseStatusCode('@tableSearchQuery', 200);
  });

  it('Remove data product assets using asset selection modal should work properly', () => {
    removeAssetsFromDataProduct(DOMAIN_2.dataProducts[0], DOMAIN_2);
  });

  it('Update domain details should work properly', () => {
    updateDomainDetails(DOMAIN_1);
  });

  it('Remove assets to domain using asset selection modal should work properly', () => {
    removeAssetsFromDomain(DOMAIN_2);
  });

  it('Assets Tab should work properly', () => {
    updateAssets(DOMAIN_1);
  });

  it('Remove Domain from entity should work properly', () => {
    removeAssets(DOMAIN_1);
  });

  it('Rename domain name and display name should work properly', () => {
    renameDomain(DOMAIN_1);
  });

  it('Delete domain flow should work properly', () => {
    [DOMAIN_1, DOMAIN_2, DOMAIN_3].forEach((domain) => {
      deleteDomain(domain);
    });
  });
});
