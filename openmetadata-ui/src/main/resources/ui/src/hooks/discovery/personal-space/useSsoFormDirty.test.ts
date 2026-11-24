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
import { renderHook } from '@testing-library/react';
import { useSsoFormDirty } from './useSsoFormDirty';

type Data = { clientId?: string; responseType?: string };

// Stands in for comparableFormData: fills the default RJSF adds after mount.
const comparable = (data?: Data) =>
  data && { responseType: 'id_token', ...data };

const render = (props: {
  hasExistingConfig: boolean;
  internalData?: Data;
  savedData?: Data;
  currentProvider?: string;
}) =>
  renderHook((p) => useSsoFormDirty<Data>({ ...p, comparable }), {
    initialProps: props,
  });

describe('useSsoFormDirty', () => {
  it('is clean before the form has data', () => {
    const { result } = render({ hasExistingConfig: true, savedData: {} });

    expect(result.current).toBe(false);
  });

  it('compares a saved setup with what is saved, through comparable', () => {
    const { result, rerender } = render({
      hasExistingConfig: true,
      savedData: { clientId: 'a' },
      internalData: { clientId: 'a', responseType: 'id_token' },
    });

    expect(result.current).toBe(false);

    rerender({
      hasExistingConfig: true,
      savedData: { clientId: 'a' },
      internalData: { clientId: 'b' },
    });

    expect(result.current).toBe(true);
  });

  it('compares a new setup with the template it opened with', () => {
    const { result, rerender } = render({
      hasExistingConfig: false,
      currentProvider: 'google',
      internalData: { clientId: '' },
    });

    expect(result.current).toBe(false);

    // RJSF filling a default is not an edit.
    rerender({
      hasExistingConfig: false,
      currentProvider: 'google',
      internalData: { clientId: '', responseType: 'id_token' },
    });

    expect(result.current).toBe(false);

    rerender({
      hasExistingConfig: false,
      currentProvider: 'google',
      internalData: { clientId: 'typed' },
    });

    expect(result.current).toBe(true);
  });

  it('takes a fresh template when the provider changes', () => {
    const { result, rerender } = render({
      hasExistingConfig: false,
      currentProvider: 'google',
      internalData: { clientId: '' },
    });

    rerender({
      hasExistingConfig: false,
      currentProvider: 'okta',
      internalData: { clientId: 'okta-default' },
    });

    expect(result.current).toBe(false);
  });
});
