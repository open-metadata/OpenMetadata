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

import { act, renderHook } from '@testing-library/react';
import { useFieldArray, useForm } from 'react-hook-form';
import { ModifiedCreateEventSubscription } from '../../pages/AddObservabilityPage/AddObservabilityPage.interface';
import { applyAlertValueChanges } from './ClassicAlertForm.utils';

const initial = {
  name: 'alert',
  resources: ['table'],
  destinations: [{ category: 'Admins' }],
} as ModifiedCreateEventSubscription;

const renderAlertForm = () =>
  renderHook(() => {
    const form = useForm<ModifiedCreateEventSubscription>({
      defaultValues: initial,
    });
    const destinations = useFieldArray({
      control: form.control,
      name: 'destinations',
    });

    return { form, destinations };
  });

describe('applyAlertValueChanges', () => {
  it('sets a template draft without replacing the form defaults', () => {
    const { result } = renderAlertForm();
    const draft = {
      displayName: 'Custom',
      templateSubject: 'Subject',
      templateBody: 'Body',
    };

    act(() =>
      applyAlertValueChanges(result.current.form.setValue, {
        customNotificationTemplateData: draft,
      })
    );

    expect(
      result.current.form.getValues('customNotificationTemplateData')
    ).toEqual(draft);
    expect(result.current.form.formState.defaultValues).toEqual(initial);
    expect(result.current.destinations.fields).toHaveLength(1);
  });

  it('clears the destinations field array on a source change', () => {
    const { result } = renderAlertForm();

    act(() =>
      applyAlertValueChanges(result.current.form.setValue, {
        resources: ['pipeline'],
        destinations: [],
      })
    );

    expect(result.current.form.getValues('resources')).toEqual(['pipeline']);
    expect(result.current.destinations.fields).toHaveLength(0);
  });
});
