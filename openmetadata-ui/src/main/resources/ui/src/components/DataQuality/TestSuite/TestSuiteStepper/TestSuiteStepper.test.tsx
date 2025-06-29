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
import { MemoryRouter } from 'react-router-dom';
import TestSuiteStepper from './TestSuiteStepper';

jest.mock('../../../../rest/ingestionPipelineAPI', () => ({
  checkAirflowStatus: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../../rest/testAPI', () => ({
  createTestSuites: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../AddDataQualityTest/rightPanelData', () => ({
  getRightPanelForAddTestSuitePage: jest.fn().mockReturnValue('Add test suite'),
}));

jest.mock('../../../../constants/TestSuite.constant', () => ({
  STEPS_FOR_ADD_TEST_SUITE: [],
  TEST_SUITE_STEPPER_BREADCRUMB: [],
}));

jest.mock('../../../../utils/RouterUtils', () => ({
  getTestSuitePath: jest.fn().mockReturnValue('/'),
}));

jest.mock('../../AddDataQualityTest/components/RightPanel', () =>
  jest.fn().mockReturnValue(<div>RightPanel</div>)
);

jest.mock('../AddTestSuiteForm/AddTestSuiteForm', () =>
  jest.fn().mockReturnValue(<div>AddTestSuiteForm</div>)
);

jest.mock('../../../common/SuccessScreen/SuccessScreen', () => {
  return jest.fn().mockReturnValue(<div>SuccessScreen</div>);
});

jest.mock(
  '../../../Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component',
  () => {
    return jest.fn().mockReturnValue(<div>Ingestion Stepper</div>);
  }
);

jest.mock('../../../common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </>
  ))
);

jest.mock('../../../common/TitleBreadcrumb/TitleBreadcrumb.component', () => {
  return jest.fn().mockReturnValue(<div>Title Breadcrumb</div>);
});

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
