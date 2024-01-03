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
import { MESSAGING_SERVICE } from '../../constants/EntityConstant';
import EntityClass from './EntityClass';

class MessagingServiceClass extends EntityClass {
  messagingService: string;

  constructor() {
    const messagingService = `cypress-messaging-service-${Date.now()}`;
    super(
      messagingService,
      MESSAGING_SERVICE.entity,
      EntityType.MessagingService
    );

    this.messagingService = messagingService;
    this.name = 'Messaging Service';
  }

  visitEntity() {
    visitServiceDetailsPage(
      {
        name: this.messagingService,
        type: SERVICE_TYPE.Messaging,
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
        ...MESSAGING_SERVICE,
        service: { ...MESSAGING_SERVICE.service, name: this.messagingService },
        entity: {
          ...MESSAGING_SERVICE.entity,
          service: this.messagingService,
        },
        token,
      });
    });
  }
}

export default MessagingServiceClass;
