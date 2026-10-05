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
import { AxiosInstance, AxiosResponse } from 'axios';
import { showInfoToast } from '../utils/ToastUtils';
import {
  attachPendingChangeInterceptor,
  PENDING_CHANGE_COUNT_HEADER,
  PENDING_CHANGE_EVENT,
  PENDING_CHANGE_HEADER,
} from './pendingChangeInterceptor';

jest.mock('../utils/ToastUtils', () => ({
  showInfoToast: jest.fn(),
}));

jest.mock('../utils/i18next/LocalUtil', () => ({
  t: (key: string, options?: { count?: number }) =>
    options?.count === undefined ? key : `${key}:${options.count}`,
}));

type ResponseHandler = (response: AxiosResponse) => AxiosResponse;

const installInterceptor = (): ResponseHandler => {
  let handler: ResponseHandler = (response) => response;
  const client = {
    interceptors: {
      response: {
        use: (onFulfilled: ResponseHandler) => {
          handler = onFulfilled;
        },
      },
    },
  } as unknown as AxiosInstance;
  attachPendingChangeInterceptor(client);

  return handler;
};

const responseWith = (headers: Record<string, string>) =>
  ({ headers, data: {}, status: 200 } as unknown as AxiosResponse);

describe('pendingChangeInterceptor', () => {
  beforeEach(() => jest.clearAllMocks());

  it('tells the user and notifies listeners when an edit was held for approval', () => {
    const handler = installInterceptor();
    const listener = jest.fn();
    window.addEventListener(PENDING_CHANGE_EVENT, listener);

    const response = responseWith({ [PENDING_CHANGE_HEADER]: 'cr-1' });

    expect(handler(response)).toBe(response);
    expect(showInfoToast).toHaveBeenCalledWith(
      'message.change-submitted-for-approval'
    );
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      changeRequestId: 'cr-1',
    });

    window.removeEventListener(PENDING_CHANGE_EVENT, listener);
  });

  it('reports how many change requests a bulk asset write submitted', () => {
    const handler = installInterceptor();
    const listener = jest.fn();
    window.addEventListener(PENDING_CHANGE_EVENT, listener);

    handler(responseWith({ [PENDING_CHANGE_COUNT_HEADER]: '3' }));

    expect(showInfoToast).toHaveBeenCalledWith(
      'message.change-plural-submitted-for-approval:3'
    );
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      count: 3,
    });

    window.removeEventListener(PENDING_CHANGE_EVENT, listener);
  });

  it('uses the single-change message when a bulk write held one asset', () => {
    const handler = installInterceptor();

    handler(responseWith({ [PENDING_CHANGE_COUNT_HEADER]: '1' }));

    expect(showInfoToast).toHaveBeenCalledWith(
      'message.change-submitted-for-approval'
    );
  });

  it('stays silent for an ordinary response', () => {
    const handler = installInterceptor();

    handler(responseWith({}));

    expect(showInfoToast).not.toHaveBeenCalled();
  });
});
