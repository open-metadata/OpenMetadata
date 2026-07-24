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
import { UseFormReturn } from 'react-hook-form';
import { setCreateEntityFieldError } from './FormDrawerUtils';
import { showErrorToast } from './ToastUtils';

jest.mock('./ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const DUPLICATE_MESSAGE = 'Domain already exists.';
const FALLBACK_TOAST = 'Error while adding domain!';

const buildForm = (setError: jest.Mock) =>
  ({ setError } as unknown as UseFormReturn<{ name: string }>);

const buildError = (message: string): AxiosError =>
  ({ response: { data: { message } } } as AxiosError);

describe('setCreateEntityFieldError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should set an inline name error and skip the toast for a duplicate-name error', () => {
    const setError = jest.fn();
    const error = buildError("Domain with name 'Finance' already exists.");

    setCreateEntityFieldError(
      error,
      buildForm(setError),
      'name',
      DUPLICATE_MESSAGE,
      FALLBACK_TOAST
    );

    expect(setError).toHaveBeenCalledWith('name', {
      type: 'manual',
      message: DUPLICATE_MESSAGE,
    });
    expect(showErrorToast).not.toHaveBeenCalled();
  });

  it('should fall back to a toast and skip the inline error for a non-duplicate error', () => {
    const setError = jest.fn();
    const error = buildError('Internal server error');

    setCreateEntityFieldError(
      error,
      buildForm(setError),
      'name',
      DUPLICATE_MESSAGE,
      FALLBACK_TOAST
    );

    expect(showErrorToast).toHaveBeenCalledWith(error, FALLBACK_TOAST);
    expect(setError).not.toHaveBeenCalled();
  });
});
