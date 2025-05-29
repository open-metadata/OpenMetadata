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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AddObservabilityPage from './AddObservabilityPage';

const MOCK_DATA = [
  {
    id: '971a21b3-eeaf-4765-bda7-4e2cdb9788de',
    name: 'alert-test',
    fullyQualifiedName: 'alert-test',
    href: 'http://localhost:8585/api/v1/events/subscriptions/971a21b3-eeaf-4765-bda7-4e2cdb9788de',
    version: 0.1,
    updatedAt: 1682366749021,
    updatedBy: 'admin',
    filteringRules: {
      resources: ['all'],
      rules: [
        {
          name: 'matchIngestionPipelineState',
          effect: 'include',
          condition: "matchIngestionPipelineState('partialSuccess')",
        },
      ],
    },
    subscriptionType: 'Email',
    subscriptionConfig: {
      receivers: ['test@gmail.com'],
    },
    enabled: true,
    batchSize: 10,
    timeout: 10,
    readTimeout: 12,
    deleted: false,
    provider: 'user',
  },
];
const mockNavigate = jest.fn();

jest.mock('../../rest/observabilityAPI', () => ({
  getObservabilityAlertByFQN: jest.fn().mockImplementation(() =>
    Promise.resolve({
      fqn: 'alert-test',
    })
  ),
  createObservabilityAlert: jest.fn().mockImplementation(() =>
    Promise.resolve({
      alert: 'Observability',
    })
  ),
  getResourceFunctions: jest.fn(),
  updateObservabilityAlert: jest.fn().mockImplementation(() =>
    Promise.resolve({
      id: 'test',
      jsonPatch: MOCK_DATA,
    })
  ),
}));

jest.mock('../../hoc/withPageLayout', () => ({
  withPageLayout: jest.fn().mockImplementation((Component) => Component),
}));

jest.mock('../../components/common/ResizablePanels/ResizablePanels', () =>
  jest.fn().mockImplementation(({ firstPanel, secondPanel }) => (
    <>
      <div>{firstPanel.children}</div>
      <div>{secondPanel.children}</div>
    </>
  ))
);

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn().mockImplementation(() => mockNavigate),
}));

const mockProps = {
  pageTitle: 'add-observability',
};

describe('Add ObservabilityPage Alerts Page Tests', () => {
  it('should render Add Observability Page', async () => {
    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(await screen.findByText('label.observability')).toBeInTheDocument();
  });

  it('should display SubTitle', async () => {
    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(
      await screen.findByText(/message.alerts-description/)
    ).toBeInTheDocument();
  });

  it('should render Add alert button', async () => {
    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    expect(await screen.findByText(/label.create-entity/)).toBeInTheDocument();
  });

  it('should display the correct breadcrumb', async () => {
    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });
    const breadcrumbLinks = screen.getAllByTestId('breadcrumb-link');

    expect(breadcrumbLinks[0]).toHaveTextContent('label.observability');
    expect(breadcrumbLinks[1]).toHaveTextContent('label.alert-plural');
    expect(breadcrumbLinks[2]).toHaveTextContent('label.create-entity');
  });

  it('should navigate back when the cancel button is clicked', async () => {
    await act(async () => {
      render(<AddObservabilityPage {...mockProps} />, {
        wrapper: MemoryRouter,
      });
    });

    const cancelButton = screen.getByTestId('cancel-button');

    await act(async () => {
      fireEvent.click(cancelButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});
