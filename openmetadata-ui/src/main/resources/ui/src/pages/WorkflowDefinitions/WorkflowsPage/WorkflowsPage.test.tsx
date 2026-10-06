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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { getWorkflowDefinitions } from '../../../rest/workflowDefinitionsAPI';
import WorkflowsPage from './WorkflowsPage';

jest.mock('../../../rest/workflowDefinitionsAPI', () => ({
  createWorkflowDefinition: jest.fn(),
  getWorkflowDefinitions: jest.fn(),
}));

jest.mock('../../../hooks/useAppMode', () => ({
  useIsAiMode: () => false,
}));

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ))
);

jest.mock('../../../components/PageHeader/PageHeader.component', () =>
  jest.fn(() => <div />)
);

jest.mock(
  '../../../components/WorkflowDefinitions/WorkflowCard/WorkflowCard.component',
  () =>
    jest.fn(({ data }: { data: { key: string } }) => (
      <div data-testid={data.key} />
    ))
);

jest.mock('../../../components/common/NextPrevious/NextPrevious', () =>
  jest.fn(() => <div />)
);

jest.mock(
  '../../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component',
  () => jest.fn(() => <div />)
);

jest.mock(
  '../../../components/Learning/LearningIcon/LearningIcon.component',
  () => ({ LearningIcon: jest.fn(() => <div />) })
);

const mockGetWorkflowDefinitions = getWorkflowDefinitions as jest.Mock;

const renderPage = () =>
  render(
    <MemoryRouter>
      <WorkflowsPage />
    </MemoryRouter>
  );

describe('WorkflowsPage on OSS', () => {
  it('does not offer workflow creation when workflows exist', async () => {
    mockGetWorkflowDefinitions.mockResolvedValue({
      data: [
        {
          id: 'w1',
          name: 'pw-oss-test-workflow',
          fullyQualifiedName: 'pw-oss-test-workflow',
        },
      ],
      paging: { total: 1 },
    });

    renderPage();

    expect(
      await screen.findByTestId('pw-oss-test-workflow')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('create-workflow-button')
    ).not.toBeInTheDocument();
  });
});
