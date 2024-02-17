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
import { SERVICE_TYPE } from '../../constants/constants';
import {
  checkServiceFieldSectionHighlighting,
  interceptURL,
  verifyResponseStatusCode,
} from '../common';
import ServiceBaseClass from '../Entities/ServiceBaseClass';
import { visitServiceDetailsPage } from '../serviceUtils';
import { Services } from '../Utils/Services';

class MysqlIngestionClass extends ServiceBaseClass {
  name: string;
  tableFilter: string;
  constructor() {
    super(Services.Database, 'cypress-mysql', 'Mysql', 'bot_entity');
    this.tableFilter = 'bot_entity{enter} alert_entity{enter} chart_entity';
  }

  createService() {
    super.createService();
  }

  fillConnectionDetails() {
    cy.get('#root\\/username').type(Cypress.env('mysqlUsername'));
    checkServiceFieldSectionHighlighting('username');
    cy.get('#root\\/authType\\/password').type(Cypress.env('mysqlPassword'));
    checkServiceFieldSectionHighlighting('password');
    cy.get('#root\\/hostPort').type(Cypress.env('mysqlHostPort'));
    checkServiceFieldSectionHighlighting('hostPort');
  }

  fillIngestionDetails() {
    cy.get('#root\\/tableFilterPattern\\/includes')
      .scrollIntoView()
      .type(this.tableFilter);
  }

  validateIngestionDetails() {
    const tables = this.tableFilter.replace(/{enter} /g, '');
    cy.get('.ant-select-selection-item-content')
      .then((content) => content.text())
      .should('deep.eq', tables);
  }

  runAdditionalTests() {
    it('Edit service connection', () => {
      interceptURL(
        'GET',
        'api/v1/teams/name/Organization?fields=*',
        'getSettingsPage'
      );
      interceptURL(
        'POST',
        '/api/v1/services/ingestionPipelines/deploy/*',
        'deployIngestion'
      );
      interceptURL(
        'POST',
        '/api/v1/services/ingestionPipelines?fields=*',
        'ingestionPipeline'
      );
      interceptURL(
        'POST',
        '/api/v1/services/ingestionPipelines/trigger/*',
        'triggerIngestionPipeline'
      );
      visitServiceDetailsPage(
        { type: SERVICE_TYPE.Database, name: this.serviceName },
        false
      );

      cy.get('[data-testid="connection"]').scrollIntoView().click();
      cy.get('[data-testid="edit-connection-button"]').scrollIntoView().click();
      cy.get('#root\\/databaseSchema').clear().type('openmetadata_db');
      interceptURL(
        'PATCH',
        '/api/v1/services/databaseServices/*',
        'editService'
      );
      cy.get('[data-testid="submit-btn"]').scrollIntoView().click();
      cy.wait('@editService').then((interception) => {
        expect(interception.request.body).to.deep.equal([
          {
            op: 'add',
            path: '/connection/config/databaseSchema',
            value: 'openmetadata_db',
          },
        ]);
      });
      cy.get('[data-testid="ingestions"]').scrollIntoView().click();
      cy.get('[data-testid="re-deploy-btn"]').scrollIntoView().click();
      verifyResponseStatusCode('@deployIngestion', 200);

      cy.reload();
      cy.get('[data-testid="run"]').scrollIntoView().click();
      verifyResponseStatusCode('@triggerIngestionPipeline', 200);
    });
  }
}

// eslint-disable-next-line jest/no-export
export default MysqlIngestionClass;
