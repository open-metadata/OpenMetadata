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
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { getEntityLinkFromType } from './EntityLinkUtils';
import { getEntityDetailsPath } from './RouterUtils';

jest.mock('./RouterUtils', () => ({
  getDataQualityPagePath: jest.fn(),
  getDomainPath: jest.fn(),
  getSettingPath: jest.fn(),
  getServiceDetailsPath: jest.fn(),
  getEntityDetailsPath: jest.fn(),
}));

describe('EntityLinkUtils unit tests', () => {
  describe('getEntityLinkFromType', () => {
    it('should trigger case for entity type TestSuite', () => {
      const fqn = 'test/testSuite';

      getEntityLinkFromType(fqn, EntityType.TEST_SUITE);

      expect(getEntityDetailsPath).toHaveBeenCalledWith(
        EntityType.TABLE,
        fqn,
        EntityTabs.PROFILER
      );
    });
  });
});
