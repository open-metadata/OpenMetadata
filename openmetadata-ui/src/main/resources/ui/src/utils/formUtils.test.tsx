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
import { AxiosError } from 'axios';
import { handleEntityCreationError } from './formUtils';

const serverError = (status: number, message: string) =>
  ({ response: { status, data: { message } } } as unknown as AxiosError);

describe('handleEntityCreationError', () => {
  it.each([
    ['create', 'server.entity-creation-error'],
    ['update', 'server.entity-updating-error'],
  ] as const)(
    'names a failed %s and keeps the reason the server gave',
    (defaultErrorType, description) => {
      const setInlineAlertDetails = jest.fn();

      handleEntityCreationError({
        error: serverError(400, 'The reason the server gave'),
        entity: 'Alert',
        entityLowercase: 'alert',
        name: 'my-alert',
        setInlineAlertDetails,
        defaultErrorType,
      });

      expect(setInlineAlertDetails).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          description,
          subDescription: 'The reason the server gave',
        })
      );
    }
  );
});
