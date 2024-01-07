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
import { visitEntityDetailsPage } from '../../common/Utils/Entity';
import { EntityType } from '../../constants/Entity.interface';
import { PIPELINE_SERVICE } from '../../constants/EntityConstant';
import EntityClass from './EntityClass';

class PipelineClass extends EntityClass {
  pipelineName: string;

  constructor() {
    const pipelineName = `cypress-pipeline-${Date.now()}`;
    super(pipelineName, PIPELINE_SERVICE.entity, EntityType.Pipeline);

    this.pipelineName = pipelineName;
    this.name = 'Pipeline';
  }

  visitEntity() {
    visitEntityDetailsPage({
      term: this.pipelineName,
      serviceName: PIPELINE_SERVICE.service.name,
      entity: this.endPoint,
    });
  }

  // Creation

  createEntity() {
    // Handle creation here

    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken as string;

      createSingleLevelEntity({
        token,
        ...PIPELINE_SERVICE,
        entity: [{ ...PIPELINE_SERVICE.entity, name: this.pipelineName }],
      });
    });
  }
}

export default PipelineClass;
