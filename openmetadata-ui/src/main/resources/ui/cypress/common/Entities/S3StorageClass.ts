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
import { checkServiceFieldSectionHighlighting } from '../common';
import { Services } from '../Utils/Services';
import ServiceBaseClass from './ServiceBaseClass';

class S3StorageIngestionClass extends ServiceBaseClass {
  name: string;
  constructor() {
    super(Services.Storage, 'cypress-s3-storage', 'S3', 'cypress-bucket');
  }

  createService() {
    super.createService();
  }

  updateService() {
    super.updateService();
  }

  fillConnectionDetails() {
    cy.get('#root\\/awsConfig\\/awsAccessKeyId').type(
      Cypress.env('s3StorageAccessKeyId')
    );
    checkServiceFieldSectionHighlighting('awsAccessKeyId');
    cy.get('#root\\/awsConfig\\/awsSecretAccessKey').type(
      Cypress.env('s3StorageSecretAccessKey')
    );
    checkServiceFieldSectionHighlighting('awsSecretAccessKey');
    cy.get('#root\\/awsConfig\\/awsRegion').type('us');
    checkServiceFieldSectionHighlighting('awsRegion');
    cy.get('#root\\/awsConfig\\/endPointURL').type(
      Cypress.env('s3StorageEndPointUrl')
    );
    checkServiceFieldSectionHighlighting('endPointURL');
  }
}

export default S3StorageIngestionClass;
