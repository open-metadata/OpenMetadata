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
import ServiceBaseClass from '../Entities/ServiceBaseClass';
import { Services } from '../Utils/Services';

class MlFlowIngestionClass extends ServiceBaseClass {
  constructor() {
    super(
      Services.MLModels,
      'cypress-Ml-Model',
      'Mlflow',
      'ElasticnetWineModel',
      false,
      false
    );
  }

  createService() {
    super.createService();
  }

  updateService() {
    // Do nothing here
  }

  fillConnectionDetails() {
    cy.get('#root\\/trackingUri').type('mlModelTrackingUri');
    checkServiceFieldSectionHighlighting('trackingUri');
    cy.get('#root\\/registryUri').type('mlModelRegistryUri');
    checkServiceFieldSectionHighlighting('registryUri');
  }

  fillIngestionDetails() {
    cy.get('#root\\/mlModelFilterPattern\\/includes')
      .scrollIntoView()
      .type(`${this.entityName}{enter}`);
  }

  deleteService() {
    super.deleteService();
  }
}

export default MlFlowIngestionClass;
