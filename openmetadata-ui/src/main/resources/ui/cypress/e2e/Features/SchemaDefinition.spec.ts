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

const table = {
  term: 'dim_address',
  serviceName: 'sample_data',
  entity: EntityType.Table,
};
const query =
  'CREATE TABLE dim_address(address_id NUMERIC PRIMARY KEY, shop_id NUMERIC)';

describe('Schema definition (views)', () => {
  beforeEach(() => {
    cy.login();
  });

  it('Verify schema definition (views) of table entity', () => {
    visitEntityDetailsPage(table);

    cy.get('[data-testid="schema_definition"]').click();
    cy.get('.CodeMirror-line > [role="presentation"]').should('contain', query);
  });
});
