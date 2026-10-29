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

import { act, renderHook } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { ModifiedCreateEventSubscription } from '../AddObservabilityPage.interface';
import { useSelectedAlertSources } from './useObservabilityAlertResources';

it('tracks programmatic source and rule changes used for capabilities requests', () => {
  const { result } = renderHook(() => {
    const form = useForm<ModifiedCreateEventSubscription>({
      defaultValues: { resources: [], input: {} },
    });

    return { form, ...useSelectedAlertSources(form) };
  });

  expect(result.current.sources).toEqual([]);

  act(() => {
    result.current.form.setValue('resources', ['table', 'topic']);
    result.current.form.setValue('input', {
      filters: [{ name: 'filterByOwnerName' }],
    });
  });

  expect(result.current.sources).toEqual(['table', 'topic']);
  expect(result.current.input).toEqual({
    filters: [{ name: 'filterByOwnerName' }],
  });
});
