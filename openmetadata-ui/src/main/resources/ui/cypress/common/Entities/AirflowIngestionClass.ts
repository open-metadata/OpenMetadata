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
import { Services } from '../Utils/Services';
import ServiceBaseClass from './ServiceBaseClass';

class MetabaseIngestionClass extends ServiceBaseClass {
  name: string;
  serviceName: string;
  serviceType: string;

  constructor() {
    super(Services.Pipeline, 'cypress-Airflow', 'Airflow', 'index_metadata');
  }

  createService() {
    super.createService();
  }

  updateService() {
    // Backend issue for udpating displayName
  }

  fillConnectionDetails() {
    cy.get('#root\\/hostPort').type(Cypress.env('airflowHostPort'));
    cy.get('#root\\/connection__oneof_select')
      .scrollIntoView()
      .select('BackendConnection');
  }

  deleteService() {
    super.deleteService();
  }
}

export default MetabaseIngestionClass;
