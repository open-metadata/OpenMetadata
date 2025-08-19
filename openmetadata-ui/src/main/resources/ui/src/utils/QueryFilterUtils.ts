/*
 *  Copyright 2024 Collate.
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

import { cloneDeep } from 'lodash';

/**
 * Remove a specific field from the query filter
 * This is used to get all available options for a field without the current filter applied
 */
export const removeFieldFromFilter = (filter: any, fieldKey: string): any => {
  if (!filter || !filter.query || !filter.query.bool || !filter.query.bool.must) {
    return filter;
  }

  const newFilter = cloneDeep(filter);
  
  // Filter out any conditions that match the field key
  newFilter.query.bool.must = newFilter.query.bool.must.filter((condition: any) => {
    // Check if this condition is for the field we want to exclude
    if (condition.bool && condition.bool.should) {
      // Check if all conditions in should array are for this field
      const isFieldCondition = condition.bool.should.every((shouldCondition: any) => {
        if (shouldCondition.term) {
          const termKey = Object.keys(shouldCondition.term)[0];
          return termKey === fieldKey || termKey === `${fieldKey}.keyword`;
        }
        if (shouldCondition.terms) {
          const termsKey = Object.keys(shouldCondition.terms)[0];
          return termsKey === fieldKey || termsKey === `${fieldKey}.keyword`;
        }
        return false;
      });
      
      return !isFieldCondition;
    }
    
    // Check direct term/terms conditions
    if (condition.term) {
      const termKey = Object.keys(condition.term)[0];
      return termKey !== fieldKey && termKey !== `${fieldKey}.keyword`;
    }
    if (condition.terms) {
      const termsKey = Object.keys(condition.terms)[0];
      return termsKey !== fieldKey && termsKey !== `${fieldKey}.keyword`;
    }
    
    return true;
  });

  // If must array is empty after filtering, return undefined to avoid sending empty filter
  if (newFilter.query.bool.must.length === 0) {
    return undefined;
  }

  return newFilter;
};