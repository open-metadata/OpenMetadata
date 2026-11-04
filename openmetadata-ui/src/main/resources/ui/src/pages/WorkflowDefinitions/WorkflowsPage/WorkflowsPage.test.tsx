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
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { getWorkflowDefinitions } from '../../../rest/workflowDefinitionsAPI';
import workflowClassBase from '../../../utils/WorkflowClassBase';
import WorkflowsPage from './WorkflowsPage';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

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
    jest.fn(
      ({
        data,
        onClick,
      }: {
        data: { key: string };
        onClick: (key: string) => void;
      }) => (
        <button data-testid={data.key} onClick={() => onClick(data.key)}>
          {data.key}
        </button>
      )
    )
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

const WORKFLOWS = {
  data: [
    {
      id: 'w1',
      name: 'pw-oss-test-workflow',
      fullyQualifiedName: 'pw-oss-test-workflow',
    },
  ],
  paging: { total: 1 },
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <WorkflowsPage />
    </MemoryRouter>
  );

describe('WorkflowsPage on OSS', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockNavigate.mockReset();
  });

  it('shows the section a downstream build adds above the workflow list', async () => {
    mockGetWorkflowDefinitions.mockResolvedValue(WORKFLOWS);
    jest
      .spyOn(workflowClassBase, 'getWorkflowsPageSection')
      .mockReturnValue(() => <section data-testid="downstream-section" />);

    renderPage();

    expect(await screen.findByTestId('downstream-section')).toBeInTheDocument();
  });

  it('narrows the list to the tab a downstream build selects', async () => {
    mockGetWorkflowDefinitions.mockResolvedValue({
      data: [
        ...WORKFLOWS.data,
        {
          id: 'w2',
          name: 'pw-oss-lifecycle',
          fullyQualifiedName: 'pw-oss-lifecycle',
        },
      ],
      paging: { total: 2 },
    });
    jest.spyOn(workflowClassBase, 'getWorkflowsPageTabs').mockReturnValue([
      { id: 'all', labelKey: 'label.all' },
      {
        id: 'lifecycle',
        labelKey: 'label.lifecycle',
        includes: (workflow) => workflow.name === 'pw-oss-lifecycle',
      },
    ]);

    renderPage();

    expect(
      await screen.findByTestId('pw-oss-test-workflow')
    ).toBeInTheDocument();
    expect(screen.getByTestId('workflow-count')).toHaveTextContent('2');

    fireEvent.click(screen.getByRole('radio', { name: 'label.lifecycle' }));

    expect(
      screen.queryByTestId('pw-oss-test-workflow')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('pw-oss-lifecycle')).toBeInTheDocument();
    expect(screen.getByTestId('workflow-count')).toHaveTextContent('1');
    expect(
      screen.getByRole('radio', { name: 'label.lifecycle' })
    ).toBeChecked();
  });

  it('lists every workflow without a filter header when no downstream build adds tabs', async () => {
    mockGetWorkflowDefinitions.mockResolvedValue(WORKFLOWS);

    renderPage();

    expect(
      await screen.findByTestId('pw-oss-test-workflow')
    ).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByTestId('workflow-count')).not.toBeInTheDocument();
  });

  it('opens the workflow details page unless a downstream build routes the workflow elsewhere', async () => {
    mockGetWorkflowDefinitions.mockResolvedValue(WORKFLOWS);
    const getWorkflowPath = jest
      .spyOn(workflowClassBase, 'getWorkflowPath')
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('/workflows/lifecycle/glossaryTerm');

    renderPage();
    fireEvent.click(await screen.findByTestId('pw-oss-test-workflow'));
    fireEvent.click(screen.getByTestId('pw-oss-test-workflow'));

    expect(getWorkflowPath).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'pw-oss-test-workflow' })
    );
    expect(mockNavigate).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('pw-oss-test-workflow')
    );
    expect(mockNavigate).toHaveBeenNthCalledWith(
      2,
      '/workflows/lifecycle/glossaryTerm'
    );
  });

  it('does not offer workflow creation when workflows exist', async () => {
    mockGetWorkflowDefinitions.mockResolvedValue(WORKFLOWS);

    renderPage();

    expect(
      await screen.findByTestId('pw-oss-test-workflow')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('create-workflow-button')
    ).not.toBeInTheDocument();
  });

  it('counts every workflow on the server, not just the loaded page, on an unfiltered tab', async () => {
    mockGetWorkflowDefinitions.mockResolvedValue({
      ...WORKFLOWS,
      paging: { total: 26 },
    });
    jest
      .spyOn(workflowClassBase, 'getWorkflowsPageTabs')
      .mockReturnValue([{ id: 'all', labelKey: 'label.all' }]);

    renderPage();

    expect(await screen.findByTestId('workflow-count')).toHaveTextContent('26');
  });

  it.each([
    [500, 'server.entity-fetch-error', true],
    [403, 'label.access-denied', false],
  ])(
    'shows an error placeholder, not the empty state, when loading fails with %s',
    async (status, text, canReload) => {
      mockGetWorkflowDefinitions.mockRejectedValue({ response: { status } });

      renderPage();

      expect(await screen.findByText(text)).toBeInTheDocument();
      expect(
        Boolean(screen.queryByRole('button', { name: 'label.reload' }))
      ).toBe(canReload);
      expect(
        screen.queryByText('message.put-your-data-operations-on-autopilot')
      ).not.toBeInTheDocument();
    }
  );

  it('shows the empty state only after a successful empty load', async () => {
    mockGetWorkflowDefinitions.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });

    renderPage();

    expect(
      await screen.findByText('message.put-your-data-operations-on-autopilot')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('server.entity-fetch-error')
    ).not.toBeInTheDocument();
  });

  it('reloads the list from the error placeholder', async () => {
    mockGetWorkflowDefinitions.mockRejectedValueOnce({
      response: { status: 500 },
    });
    mockGetWorkflowDefinitions.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });

    renderPage();

    fireEvent.click(
      await screen.findByRole('button', { name: 'label.reload' })
    );

    expect(
      await screen.findByText('message.put-your-data-operations-on-autopilot')
    ).toBeInTheDocument();
  });
});
