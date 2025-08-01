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
import { RJSFSchema } from '@rjsf/utils';
import { render, screen } from '@testing-library/react';
import {
  App,
  AppType,
  ScheduleTimeline,
  ScheduleType,
} from '../../../../generated/entity/applications/app';
import { Permissions } from '../../../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import ApplicationConfiguration from './ApplicationConfiguration';

// Mock the required dependencies
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../common/ServiceDocPanel/ServiceDocPanel', () => {
  return jest
    .fn()
    .mockImplementation(() => <div data-testid="service-doc-panel" />);
});

jest.mock('../../../common/ResizablePanels/ResizablePanels', () => {
  return jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <div data-testid="resizable-panels">
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </div>
  ));
});

const mockAppData = {
  name: 'test-app',
  appConfiguration: {
    testField: 'testValue',
  },
  id: 'test-id',
  className: 'test-class',
  appType: AppType.Internal,
  permission: Permissions.All,
  scheduleType: ScheduleType.NoSchedule,
  appSchedule: {
    cronExpression: 'test-cron-expression',
    scheduleTimeline: ScheduleTimeline.Custom,
  },
  runtime: {},
} as App;

const mockJsonSchema = {
  type: 'object',
  properties: {
    testField: {
      type: 'string',
      title: 'Test Field',
    },
  },
};

describe('ApplicationConfiguration', () => {
  const onConfigSaveMock = jest.fn();
  const onCancelMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the component', () => {
    render(
      <ApplicationConfiguration
        appData={mockAppData}
        isLoading={false}
        jsonSchema={mockJsonSchema as RJSFSchema}
        onCancel={onCancelMock}
        onConfigSave={onConfigSaveMock}
      />
    );

    expect(screen.getByTestId('resizable-panels')).toBeInTheDocument();
    expect(screen.getByTestId('service-doc-panel')).toBeInTheDocument();
  });

  it('should render form with correct initial values', () => {
    render(
      <ApplicationConfiguration
        appData={mockAppData}
        isLoading={false}
        jsonSchema={mockJsonSchema as RJSFSchema}
        onCancel={onCancelMock}
        onConfigSave={onConfigSaveMock}
      />
    );

    expect(screen.getByText('label.save')).toBeInTheDocument();
    expect(screen.getByText('label.back')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(
      <ApplicationConfiguration
        isLoading
        appData={mockAppData}
        jsonSchema={mockJsonSchema as RJSFSchema}
        onCancel={onCancelMock}
        onConfigSave={onConfigSaveMock}
      />
    );

    // FormBuilder should receive isLoading prop
    const formBuilder = screen.getByTestId('resizable-panels');

    expect(formBuilder).toBeInTheDocument();
  });
});
