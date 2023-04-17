/*
 *  Copyright 2022 Collate.
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

import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import TestSuiteStepper from './TestSuiteStepper';

jest.mock('rest/ingestionPipelineAPI', () => ({
  checkAirflowStatus: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('rest/testAPI', () => ({
  createTestSuites: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: jest.fn(),
  })),
}));

jest.mock('components/AddDataQualityTest/rightPanelData', () => ({
  getRightPanelForAddTestSuitePage: jest.fn().mockReturnValue('Add test suite'),
}));

jest.mock('../../utils/CommonUtils', () => ({
  getCurrentUserId: jest.fn().mockReturnValue('1'),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getTestSuitePath: jest.fn().mockReturnValue('/'),
}));

jest.mock('components/AddDataQualityTest/components/RightPanel', () =>
  jest.fn().mockReturnValue(<div>RightPanel</div>)
);

jest.mock('./AddTestSuiteForm', () =>
  jest.fn().mockReturnValue(<div>AddTestSuiteForm</div>)
);

jest.mock('components/AddDataQualityTest/TestSuiteIngestion', () => {
  return jest.fn().mockReturnValue(<div>TestSuiteIngestion</div>);
});

jest.mock('components/common/success-screen/SuccessScreen', () => {
  return jest.fn().mockReturnValue(<div>SuccessScreen</div>);
});

jest.mock('components/IngestionStepper/IngestionStepper.component', () => {
  return jest.fn().mockReturnValue(<div>Ingestion Stepper</div>);
});

jest.mock(
  'components/common/title-breadcrumb/title-breadcrumb.component',
  () => {
    return jest.fn().mockReturnValue(<div>Title Breadcrumb</div>);
  }
);

jest.mock('components/containers/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children, leftPanel, rightPanel }) => (
    <div>
      {leftPanel}
      {children}
      {rightPanel}
    </div>
  ))
);

describe('Test Suite Stepper Page', () => {
  it('Component should render', async () => {
    await act(async () => {
      render(<TestSuiteStepper />, {
        wrapper: MemoryRouter,
      });
    });

    const container = await screen.findByTestId('test-suite-stepper-container');
    screen.debug(container);
    const header = await screen.findByTestId('header');
    const testSuiteStepper = await screen.findByText('Ingestion Stepper');
    const addTestSuiteForm = await screen.findByText('AddTestSuiteForm');
    const rightPanel = await screen.findByText('RightPanel');

    expect(container).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(testSuiteStepper).toBeInTheDocument();
    expect(addTestSuiteForm).toBeInTheDocument();
    expect(rightPanel).toBeInTheDocument();
  });
});
