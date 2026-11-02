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
import { toast } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { showErrorToast } from './ToastUtils';

// setupTests mocks ToastUtils globally; this suite tests the real one.
jest.unmock('./ToastUtils');

jest.mock('@openmetadata/ui-core-components', () => ({
  toast: { error: jest.fn(), warning: jest.fn() },
}));

const patchError = (message: string) =>
  ({
    config: { method: 'patch' },
    response: { status: 400, data: { message } },
  } as unknown as AxiosError);

describe('showErrorToast', () => {
  it('replaces a stale-patch error, which dumps the entity, with a refresh hint', () => {
    showErrorToast(
      patchError(
        '{"id":"1","tags":[],"votes":{}} contains no mapping for the name \'extension\''
      )
    );

    expect(toast.error).toHaveBeenCalledWith(
      'server.entity-changed-refresh-and-retry',
      {}
    );
  });

  it('shows other server messages as they are', () => {
    showErrorToast(patchError('Name is required'));

    expect(toast.error).toHaveBeenCalledWith('Name is required', {});
  });
});
