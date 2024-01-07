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
import {
  MESSAGING_SERVICE,
  TOPIC_DETAILS,
} from '../../constants/EntityConstant';
import EntityClass from './EntityClass';

class TopicClass extends EntityClass {
  constructor() {
    const topicName = `cypress-topic-${Date.now()}`;
    super(topicName, TOPIC_DETAILS, EntityType.Topic);

    this.name = 'Topic';
  }

  visitEntity() {
    visitEntityDetailsPage({
      term: this.entityName,
      serviceName: MESSAGING_SERVICE.service.name,
      entity: this.endPoint,
    });
  }

  // Creation

  createEntity() {
    // Handle creation here

    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      createSingleLevelEntity({
        ...MESSAGING_SERVICE,
        entity: { ...MESSAGING_SERVICE.entity, name: this.entityName },
        token: token,
      });
    });
  }
}

export default TopicClass;
