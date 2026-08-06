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
import { NON_SESSION_AUTH_ERROR } from '../constants/Auth.constants';

// setupTests.js stubs this module globally for every other suite; pull the real implementation
// rather than relying on a static import surviving an unmock.
const { showErrorToast } =
  jest.requireActual<typeof import('./ToastUtils')>('./ToastUtils');

jest.mock('@openmetadata/ui-core-components', () => ({
  toast: {
    error: jest.fn(),
    warning: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('./i18next/LocalUtil', () => ({
  t: jest.fn().mockImplementation((key: string) => key),
}));

const buildAxiosError = (
  status: number,
  method: string,
  message: string,
  extras: Record<string, unknown> = {}
) =>
  ({
    config: { method },
    response: { status, data: { message } },
    ...extras,
  } as unknown as AxiosError);

describe('showErrorToast', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should suppress a 401 that came from a dead session', () => {
    // The forced logout shows its own "session expired" message; a second toast is noise.
    showErrorToast(buildAxiosError(401, 'get', 'Expired token!'));

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('should show a 401 the auth interceptor flagged as not a session failure', () => {
    // See https://github.com/open-metadata/openmetadata-collate/issues/4647 — this is the Argo
    // case: our session is fine, the endpoint's own upstream credentials were rejected, and
    // nothing else will tell the user what went wrong.
    showErrorToast(
      buildAxiosError(
        401,
        'post',
        'The configured Argo token is not authorized',
        {
          [NON_SESSION_AUTH_ERROR]: true,
        }
      )
    );

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Argo token'),
      expect.anything()
    );
  });

  it('should keep suppressing a 403 on a read', () => {
    // Permission-gated reads are everywhere and the pages render their own placeholder.
    showErrorToast(buildAxiosError(403, 'get', 'Principal not authorized'));

    expect(toast.error).not.toHaveBeenCalled();
  });

  it('should show a 403 on a write', () => {
    showErrorToast(buildAxiosError(403, 'put', 'Principal not authorized'));

    expect(toast.error).toHaveBeenCalled();
  });

  it('should show a 502 from an upstream dependency', () => {
    showErrorToast(
      buildAxiosError(502, 'post', 'The Argo Server rejected the request')
    );

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Argo Server'),
      expect.anything()
    );
  });
});
