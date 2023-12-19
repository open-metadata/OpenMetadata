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

import { createSingleLevelEntity } from '../../common/EntityUtils';
import { visitServiceDetailsPage } from '../../common/serviceUtils';
import { SERVICE_TYPE } from '../../constants/constants';
import { ML_MODEL_SERVICE } from '../../constants/EntityConstant';
import EntityClass, { EntityType } from './EntityClass';

class MlModelServiceClass extends EntityClass {
  mlModelServiceName: string;

  constructor() {
    const mlModelServiceName = `cypress-mlmodel-service-${Date.now()}`;
    super(
      mlModelServiceName,
      ML_MODEL_SERVICE.entity,
      EntityType.MlModelService
    );

    this.mlModelServiceName = mlModelServiceName;
    this.name = 'MlModel Service';
  }

  visitEntity() {
    visitServiceDetailsPage(
      {
        name: this.mlModelServiceName,
        type: SERVICE_TYPE.MLModels,
      },
      false
    );
  }

  // Creation

  createEntity() {
    // Handle creation here

    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken as string;

      createSingleLevelEntity({
        ...ML_MODEL_SERVICE,
        service: { ...ML_MODEL_SERVICE.service, name: this.mlModelServiceName },
        entity: {
          ...ML_MODEL_SERVICE.entity,
          service: this.mlModelServiceName,
        },
        token,
      });
    });
  }
}

export default MlModelServiceClass;
