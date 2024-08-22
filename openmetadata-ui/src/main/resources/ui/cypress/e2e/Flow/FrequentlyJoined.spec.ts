/*
 *  Copyright 2024 Collate.
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
import { visitEntityDetailsPage } from '../../common/Utils/Entity';
import { EntityType } from '../../constants/Entity.interface';

describe('Frequently Joined', () => {
  beforeEach(() => {
    cy.login();
  });

  it('should display frequently joined rooms', () => {
    visitEntityDetailsPage({
      term: 'fact_sale',
      entity: EntityType.Table,
      serviceName: 'sample_data',
    });

    cy.get(
      '[data-row-key="sample_data.ecommerce_db.shopify.fact_sale.customer_id"]'
    ).scrollIntoView();

    cy.get(
      '[data-row-key="sample_data.ecommerce_db.shopify.fact_sale.customer_id"]'
    ).should(
      'contain',
      'Frequently Joined Columns:ecommerce_db.shopify.dim_customer.customer_id'
    );

    cy.get(
      '[data-row-key="sample_data.ecommerce_db.shopify.fact_sale.customer_id"]'
    )
      .contains('ecommerce_db.shopify.dim_customer.customer_id')
      .click();
    cy.url().should('include', 'ecommerce_db.shopify.dim_customer.customer_id');
  });
});
