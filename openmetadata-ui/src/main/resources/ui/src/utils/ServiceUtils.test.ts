/*
 *  Copyright 2025 Collate.
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
import { getCompleteActiveFieldName } from './ServiceUtils';

describe('Service Utils', () => {
  describe('getCompleteActiveFieldName', () => {
    it('should handle various cases correctly', () => {
      expect(getCompleteActiveFieldName()).toBeUndefined();
      expect(getCompleteActiveFieldName('root/field1/field2')).toBe(
        'field1.field2'
      );
      expect(getCompleteActiveFieldName('root')).toBe('');
      expect(getCompleteActiveFieldName('root/1/2/3')).toBe('');
      expect(getCompleteActiveFieldName('field1/field2')).toBe('field2');
      expect(getCompleteActiveFieldName('root/field1/@special/field2')).toBe(
        'field1.@special.field2'
      );
    });
  });
});
