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

import { fireEvent, render, screen } from '@testing-library/react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ServiceCategory } from '../../../enums/service.enum';
import { Operation } from '../../../generated/entity/policies/policy';
import { AutoPilotAction } from '../../../utils/ExtensionPointTypes';
import ServiceAutoPilotButton from './ServiceAutoPilotButton';

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  Trigger: () => null,
}));

let mockCanTriggerAutoPilot = true;
jest.mock('../../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: () => ({
    can: (operation: Operation) =>
      operation === Operation.Trigger && mockCanTriggerAutoPilot,
  }),
}));

const TRIGGER_PERMISSION = { Trigger: true } as OperationPermission;

const renderButton = (
  action: Partial<AutoPilotAction> = {},
  serviceCategory = ServiceCategory.DATABASE_SERVICES,
  servicePermission = TRIGGER_PERMISSION
) =>
  render(
    <ServiceAutoPilotButton
      autoPilotAction={{
        onTrigger: jest.fn(),
        isLoading: false,
        isDisabled: false,
        ...action,
      }}
      serviceCategory={serviceCategory}
      servicePermission={servicePermission}
    />
  );

describe('ServiceAutoPilotButton', () => {
  beforeEach(() => {
    mockCanTriggerAutoPilot = true;
  });

  it('triggers AutoPilot on press', () => {
    const onTrigger = jest.fn();
    renderButton({ onTrigger });

    fireEvent.click(
      screen.getByTestId('trigger-auto-pilot-application-button')
    );

    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('is disabled while the action says so', () => {
    renderButton({ isDisabled: true });

    expect(
      screen.getByTestId('trigger-auto-pilot-application-button')
    ).toBeDisabled();
  });

  it('is withheld from a user who may not trigger the service', () => {
    renderButton(
      {},
      ServiceCategory.DATABASE_SERVICES,
      {} as OperationPermission
    );

    expect(
      screen.queryByTestId('trigger-auto-pilot-application-button')
    ).not.toBeInTheDocument();
  });

  it('is withheld from a user who may not trigger the AutoPilot application', () => {
    mockCanTriggerAutoPilot = false;
    renderButton();

    expect(
      screen.queryByTestId('trigger-auto-pilot-application-button')
    ).not.toBeInTheDocument();
  });

  it('is withheld from a security service, which AutoPilot does not run on', () => {
    renderButton({}, ServiceCategory.SECURITY_SERVICES);

    expect(
      screen.queryByTestId('trigger-auto-pilot-application-button')
    ).not.toBeInTheDocument();
  });
});
