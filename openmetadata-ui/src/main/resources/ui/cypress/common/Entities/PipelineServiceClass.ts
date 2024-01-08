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
import { EntityType } from '../../constants/Entity.interface';
import { PIPELINE_SERVICE } from '../../constants/EntityConstant';
import EntityClass from './EntityClass';

class PipelineServiceClass extends EntityClass {
  pipelineServiceName: string;

  constructor() {
    const pipelineServiceName = `cypress-pipeline-service-${Date.now()}`;
    super(
      pipelineServiceName,
      PIPELINE_SERVICE.entity,
      EntityType.PipelineService
    );

    this.pipelineServiceName = pipelineServiceName;
    this.name = 'Pipeline Service';
  }

  visitEntity() {
    visitServiceDetailsPage(
      {
        name: this.pipelineServiceName,
        type: SERVICE_TYPE.Pipeline,
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
        ...PIPELINE_SERVICE,
        service: {
          ...PIPELINE_SERVICE.service,
          name: this.pipelineServiceName,
        },
        entity: {
          ...PIPELINE_SERVICE.entity,
          service: this.pipelineServiceName,
        },
        token,
      });
    });
  }
}

export default PipelineServiceClass;
