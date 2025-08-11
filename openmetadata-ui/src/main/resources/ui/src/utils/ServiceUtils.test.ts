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
import { getActiveFieldNameForAppDocs } from './ServiceUtils';

describe('Service Utils', () => {
  describe('getActiveFieldNameForAppDocs', () => {
    it('should handle various cases correctly', () => {
      expect(getActiveFieldNameForAppDocs()).toBeUndefined();
      expect(getActiveFieldNameForAppDocs('root/field1/field2')).toBe(
        'field1.field2'
      );
      expect(getActiveFieldNameForAppDocs('root')).toBe('');
      expect(getActiveFieldNameForAppDocs('root/1/2/3')).toBe('');
      expect(getActiveFieldNameForAppDocs('field1/field2')).toBe('field2');
      expect(getActiveFieldNameForAppDocs('root/field1/@special/field2')).toBe(
        'field1.@special.field2'
      );
    });
  });
});
