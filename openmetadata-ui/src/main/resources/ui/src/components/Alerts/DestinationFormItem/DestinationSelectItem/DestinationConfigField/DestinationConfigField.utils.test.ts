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

import { isValidEmailAddress } from './DestinationConfigField.utils';

describe('DestinationConfigField utils', () => {
  it.each(['alerts@example.com', 'data.quality+prod@example.co.uk'])(
    'accepts the valid email address %s',
    (email) => {
      expect(isValidEmailAddress(email)).toBe(true);
    }
  );

  it.each(['alerts', 'alerts@', '@example.com', 'alerts @example.com'])(
    'rejects the invalid email address %s',
    (email) => {
      expect(isValidEmailAddress(email)).toBe(false);
    }
  );
});
