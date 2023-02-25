/*
 *  Copyright 2022 Collate.
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

import { QueryFilterInterface } from 'pages/explore/ExplorePage.interface';
import { QueryFilterFieldsEnum } from '../../enums/Explore.enum';
import {
  getCombinedFields,
  getCombinedQueryFilterObject,
  getQueryFiltersArray,
} from './ExplorePageUtils';
import {
  mockAdvancedSearchQueryFilters,
  mockCombinedMustFieldArray,
  mockCombinedQueryFilterValue,
  mockESQueryFilters,
  mockQueryFilterArray,
} from './mocks/ExplorePageUtils.mock';

describe('ExplorePageUtils test', () => {
  it('Function getCombinedQueryFilterObject should return proper combined filters for two different query filter objects', () => {
    // Both query filter objects have type as Record<string, unknown>
    // Here unknown will not allow us to directly access the properties
    // That is why I first did typecast it into QueryFilterInterface type to access the properties.
    const combinedQueryFilterObject = getCombinedQueryFilterObject(
      mockESQueryFilters as unknown as QueryFilterInterface,
      mockAdvancedSearchQueryFilters as unknown as QueryFilterInterface
    );

    expect(combinedQueryFilterObject).toEqual(mockCombinedQueryFilterValue);
  });

  it('Function getCombinedFields should return the value in the correct field given in the input', () => {
    const combinedMustFieldArray = getCombinedFields(
      QueryFilterFieldsEnum.MUST,
      mockESQueryFilters as unknown as QueryFilterInterface,
      mockAdvancedSearchQueryFilters as unknown as QueryFilterInterface
    );

    expect(combinedMustFieldArray).toEqual(mockCombinedMustFieldArray);
  });

  it('Function getQueryFiltersArray should return the array for non empty input array', () => {
    const queryFilterArray = getQueryFiltersArray(
      mockESQueryFilters.query.bool.must as unknown as QueryFilterInterface[]
    );

    expect(queryFilterArray).toEqual(mockQueryFilterArray);
  });

  it('Function getQueryFiltersArray should return an empty array for undefined or empty array input', () => {
    const queryFilterArrayUndefined = getQueryFiltersArray(undefined);
    const queryFilterArrayEmpty = getQueryFiltersArray([]);

    expect(queryFilterArrayUndefined).toEqual([]);
    expect(queryFilterArrayEmpty).toEqual([]);
  });
});
