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
import { getWorkflowDefinitionByFQN } from '../../../rest/workflowDefinitionsAPI';
import WorkflowBuilder from './WorkflowBuilder';

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: () => ({ fqn: 'GlossaryTermApprovalWorkflow' }),
}));

jest.mock('../../../hooks/useAppMode', () => ({
  useIsAiMode: () => false,
}));

jest.mock('../../../rest/workflowDefinitionsAPI', () => ({
  getWorkflowDefinitionByFQN: jest.fn(),
}));

jest.mock('../../../rest/metadataTypeAPI', () => ({
  getWorkflowTriggerFields: jest
    .fn()
    .mockResolvedValue({ common: [], entitySpecific: {} }),
}));

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ))
);

jest.mock(
  '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => jest.fn(() => <nav data-testid="breadcrumb" />)
);

const mockGetWorkflowDefinitionByFQN = getWorkflowDefinitionByFQN as jest.Mock;

const renderBuilder = () =>
  render(
    <MemoryRouter>
      <WorkflowBuilder />
    </MemoryRouter>
  );

describe('WorkflowBuilder load failure', () => {
  it.each([
    [500, 'server.entity-fetch-error', true],
    [403, 'label.access-denied', false],
  ])(
    'shows an error placeholder instead of an editable blank canvas on a %s',
    async (status, text, canReload) => {
      mockGetWorkflowDefinitionByFQN.mockRejectedValue({
        response: { status },
      });

      renderBuilder();

      expect(await screen.findByText(text)).toBeInTheDocument();
      expect(
        Boolean(screen.queryByRole('button', { name: 'label.reload' }))
      ).toBe(canReload);
      expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
      expect(
        screen.queryByTestId('edit-workflow-button')
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId('workflow-header')).not.toBeInTheDocument();
    }
  );
});
