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
import {
  checkServiceFieldSectionHighlighting,
  deleteCreatedService,
  goToAddNewServicePage,
  testServiceCreationAndIngestion,
  uuid,
} from '../../common/common';
import { API_SERVICE, SERVICE_TYPE } from '../../constants/constants';

const serviceType = 'Mlflow';
const serviceName = `${serviceType}-ct-test-${uuid()}`;
const modelName = 'ElasticnetWineModel';

const connectionInput = () => {
  cy.get('#root\\/trackingUri').type('mlModelTrackingUri');
  checkServiceFieldSectionHighlighting('trackingUri');
  cy.get('#root\\/registryUri').type('mlModelRegistryUri');
  checkServiceFieldSectionHighlighting('registryUri');
};

const addIngestionInput = () => {
  cy.get('#root\\/mlModelFilterPattern\\/includes')
    .scrollIntoView()
    .type(`${modelName}{enter}`);
};

describe('ML Flow Ingestion', () => {
  beforeEach(() => {
    cy.login();
  });

  it('add and ingest data', () => {
    goToAddNewServicePage(SERVICE_TYPE.MLModels);

    testServiceCreationAndIngestion({
      serviceType,
      connectionInput,
      addIngestionInput,
      serviceName,
      type: SERVICE_TYPE.MLModels,
      serviceCategory: 'MlModel',
      shouldAddIngestion: false,
      allowTestConnection: false,
    });
  });

  it('delete created service', () => {
    deleteCreatedService(
      SERVICE_TYPE.MLModels,
      serviceName,
      API_SERVICE.mlmodelServices,
      'Mlmodel'
    );
  });
});
