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
import { SEARCH_SERVICE } from '../../constants/EntityConstant';
import EntityClass from './EntityClass';

class SearchServiceClass extends EntityClass {
  searchServiceName: string;

  constructor() {
    const searchServiceName = `cypress-search-service-${Date.now()}`;
    super(searchServiceName, SEARCH_SERVICE.entity, EntityType.SearchService);

    this.searchServiceName = searchServiceName;
    this.name = 'Search Service';
  }

  visitEntity() {
    visitServiceDetailsPage(
      {
        name: this.searchServiceName,
        type: SERVICE_TYPE.Search,
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
        ...SEARCH_SERVICE,
        service: {
          ...SEARCH_SERVICE.service,
          name: this.searchServiceName,
        },
        entity: {
          ...SEARCH_SERVICE.entity,
          service: this.searchServiceName,
        },
        token,
      });
    });
  }
}

export default SearchServiceClass;
