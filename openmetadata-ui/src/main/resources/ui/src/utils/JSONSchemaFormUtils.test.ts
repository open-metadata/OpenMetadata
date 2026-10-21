/*
 *  Copyright 2026 Collate.
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

import { formatFormDataForSubmit } from './JSONSchemaFormUtils';

describe('formatFormDataForSubmit', () => {
  it('drops map rows that were added but never filled in', () => {
    expect(
      formatFormDataForSubmit({
        connectionOptions: { newKey: 'New Value', sslmode: 'require' },
        connectionArguments: { 'newKey-1': 'New Value' },
      })
    ).toEqual({
      connectionOptions: { sslmode: 'require' },
      connectionArguments: {},
    });
  });

  it('keeps a row whose key or value the user changed', () => {
    expect(
      formatFormDataForSubmit({
        connectionOptions: { newKey: 'verify-full', sslmode: 'New Value' },
      })
    ).toEqual({
      connectionOptions: { newKey: 'verify-full', sslmode: 'New Value' },
    });
  });
});
