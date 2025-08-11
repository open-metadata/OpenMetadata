/*
 *  Copyright 2025 Collate.
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
import { act } from '@testing-library/react';
import { AlertType, useAlertStore } from './useAlertStore';

describe('useAlertStore', () => {
  it('should update the alert state when addAlert is called', () => {
    const { alert, animationClass, addAlert } = useAlertStore.getState();

    expect(alert).toBeUndefined();
    expect(animationClass).toBe('');

    const testAlert: AlertType = {
      type: 'error',
      message: 'Test error message',
    };

    act(() => {
      addAlert(testAlert);
    });

    expect(useAlertStore.getState().alert).toEqual(testAlert);
    expect(useAlertStore.getState().animationClass).toBe('show-alert');
  });

  it('should reset the alert state when resetAlert is called', () => {
    const { resetAlert, addAlert } = useAlertStore.getState();

    const testAlert: AlertType = {
      type: 'info',
      message: 'Test info message',
    };

    act(() => {
      addAlert(testAlert);
    });

    expect(useAlertStore.getState().alert).toEqual(testAlert);

    act(() => {
      resetAlert();
    });

    expect(useAlertStore.getState().alert).toBeUndefined();
  });
});
