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
import { visitEntityDetailsPage } from '../../common/common';
import { createSingleLevelEntity } from '../../common/EntityUtils';
import {
  SEARCH_INDEX_DETAILS,
  SEARCH_SERVICE,
} from '../../constants/EntityConstant';
import EntityClass, { EntityType } from './EntityClass';

class SearchIndexClass extends EntityClass {
  constructor() {
    const topicName = `cypress-search-index-${Date.now()}`;
    super(topicName, SEARCH_INDEX_DETAILS, EntityType.SeachIndex);

    this.name = 'SearchIndex';
  }

  visitEntity() {
    visitEntityDetailsPage({
      term: this.entityName,
      serviceName: SEARCH_SERVICE.service.name,
      entity: this.endPoint,
      dataTestId: null,
      entityFqn: null,
      entityType: null,
    });
  }

  // Creation

  createEntity() {
    // Handle creation here

    cy.getAllLocalStorage().then((data) => {
      const token = Object.values(data)[0].oidcIdToken;

      createSingleLevelEntity({
        ...SEARCH_SERVICE,
        entity: { ...SEARCH_SERVICE.entity, name: this.entityName },
        token: token,
      });
    });
  }
}

export default SearchIndexClass;
