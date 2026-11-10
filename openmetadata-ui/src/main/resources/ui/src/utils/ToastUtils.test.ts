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

const STALE_PATCH_MESSAGE =
  'The JSON Object \'{"id":"1","name":"orders","tags":[],"votes":{}}\' contains no mapping for the name \'extension\'';

const serverError = (method: string, message: string) =>
  ({
    config: { method },
    response: { status: 400, data: { message } },
  } as unknown as AxiosError);

describe('showErrorToast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('replaces a stale-patch error, which embeds the whole entity, with a refresh hint', () => {
    showErrorToast(serverError('patch', STALE_PATCH_MESSAGE));

    expect(toast.error).toHaveBeenCalledWith(
      'server.entity-changed-refresh-and-retry',
      {}
    );
  });

  it('leaves the same message alone when it did not come from a PATCH', () => {
    showErrorToast(serverError('put', STALE_PATCH_MESSAGE));

    expect(toast.error).toHaveBeenCalledWith(STALE_PATCH_MESSAGE, {});
  });

  it('shows other PATCH errors as the server sent them', () => {
    showErrorToast(serverError('patch', 'Name is required'));

    expect(toast.error).toHaveBeenCalledWith('Name is required', {});
  });
});
