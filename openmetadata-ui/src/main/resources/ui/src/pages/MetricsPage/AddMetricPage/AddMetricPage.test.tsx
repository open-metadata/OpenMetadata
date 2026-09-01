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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Language } from '../../../generated/api/data/createMetric';
import {
  createMetricGroup,
  deleteMetricGroup,
} from '../../../rest/metricGroupsAPI';
import { createMetric } from '../../../rest/metricsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import AddMetricPage from './AddMetricPage';

const mockNavigate = jest.fn();
const mockDocumentTitle = jest.fn();
let query = '';

jest.mock('../../../components/common/DocumentTitle/DocumentTitle', () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => {
    mockDocumentTitle(title);

    return null;
  },
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(query), jest.fn()],
}));

jest.mock('../../../rest/metricsAPI', () => ({
  createMetric: jest.fn(),
}));

jest.mock('../../../rest/metricGroupsAPI', () => ({
  createMetricGroup: jest.fn(),
  deleteMetricGroup: jest.fn(),
  getMetricGroups: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock(
  '../../../components/Metric/MetricGroupSelect/MetricGroupSelect',
  () => ({
    __esModule: true,
    default: ({
      onChange,
    }: {
      onChange: (name?: string, isNew?: boolean) => void;
    }) => (
      <div>
        <button
          data-testid="pick-existing-group"
          type="button"
          onClick={() => onChange('profitability', false)}>
          existing
        </button>
        <button
          data-testid="pick-new-group"
          type="button"
          onClick={() => onChange('retention', true)}>
          new
        </button>
      </div>
    ),
  })
);

jest.mock(
  '../../../components/Metric/MetricReferencePicker/MetricReferencePicker',
  () => ({
    __esModule: true,
    default: ({
      label,
      onChange,
    }: {
      label: string;
      onChange: (references: unknown[]) => void;
    }) => {
      const references: Record<string, unknown> = {
        'label.owner-plural': {
          id: 'owner-id',
          name: 'analytics',
          type: 'team',
        },
        'label.reviewer-plural': {
          id: 'reviewer-id',
          name: 'reviewer',
          fullyQualifiedName: 'reviewer',
          type: 'user',
        },
        'label.expert-plural': {
          id: 'expert-id',
          name: 'expert',
          fullyQualifiedName: 'expert',
          type: 'user',
        },
        'label.domain-plural': {
          id: 'domain-id',
          name: 'finance',
          fullyQualifiedName: 'finance',
          type: 'domain',
        },
        'label.related-metric-plural': {
          id: 'related-id',
          name: 'revenue',
          fullyQualifiedName: 'finance.revenue',
          type: 'metric',
        },
      };

      return (
        <button
          data-testid={`pick-${label}`}
          type="button"
          onClick={() => onChange([references[label]])}>
          {label}
        </button>
      );
    },
  })
);

const renderPage = (pageTitle?: string) =>
  render(
    <MemoryRouter>
      <AddMetricPage pageTitle={pageTitle} />
    </MemoryRouter>
  );

const enterRequiredFields = () => {
  fireEvent.change(screen.getByTestId('name'), {
    target: { value: 'gross_margin_rate' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: /label.code/ }), {
    target: { value: 'SUM(profit) / SUM(revenue)' },
  });
};

describe('AddMetricPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query = '';
    (createMetric as jest.Mock).mockResolvedValue({
      id: 'new-metric-id',
      fullyQualifiedName: 'gross_margin_rate',
    });
    (createMetricGroup as jest.Mock).mockResolvedValue({
      id: 'new-group-id',
      fullyQualifiedName: 'retention',
    });
    (deleteMetricGroup as jest.Mock).mockResolvedValue(undefined);
  });

  it('uses the route-provided localized page title', () => {
    renderPage('Create governed metric');

    expect(screen.getByTestId('heading')).toHaveTextContent(
      'Create governed metric'
    );
    expect(mockDocumentTitle).toHaveBeenCalledWith('Create governed metric');
  });

  it('creates an existing-group root through the atomic CreateMetric contract', async () => {
    renderPage();
    enterRequiredFields();
    fireEvent.click(screen.getByTestId('pick-existing-group'));
    fireEvent.click(screen.getByTestId('create-button'));

    await waitFor(() =>
      expect(createMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'gross_margin_rate',
          metricGroup: 'profitability',
          metricExpression: {
            code: 'SUM(profit) / SUM(revenue)',
            language: Language.SQL,
          },
        })
      )
    );

    expect(createMetricGroup).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('gross_margin_rate')
    );
  });

  it('creates a new group before assigning it and removes the empty group if metric creation fails', async () => {
    (createMetric as jest.Mock).mockRejectedValue(new Error('metric failed'));
    renderPage();
    enterRequiredFields();
    fireEvent.click(screen.getByTestId('pick-new-group'));
    fireEvent.click(screen.getByTestId('create-button'));

    await waitFor(() =>
      expect(createMetricGroup).toHaveBeenCalledWith({ name: 'retention' })
    );

    expect(createMetric).toHaveBeenCalledWith(
      expect.objectContaining({ metricGroup: 'retention' })
    );
    expect(deleteMetricGroup).toHaveBeenCalledWith('new-group-id', true);
    expect(showErrorToast).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('creates child metrics with their parent and inherited group membership', async () => {
    query = 'parent=profitability.margin';
    renderPage();
    enterRequiredFields();

    expect(screen.queryByTestId('metric-group-field')).not.toBeInTheDocument();
    expect(screen.getByTestId('metric-group-inherited')).toHaveTextContent(
      'profitability.margin'
    );

    fireEvent.click(screen.getByTestId('create-button'));

    await waitFor(() =>
      expect(createMetric).toHaveBeenCalledWith(
        expect.objectContaining({ parent: 'profitability.margin' })
      )
    );

    expect(createMetric).toHaveBeenCalledWith(
      expect.not.objectContaining({ metricGroup: expect.anything() })
    );
  });

  it('creates reviewer-governed Metrics with searchable metadata selections', async () => {
    renderPage();
    enterRequiredFields();
    fireEvent.click(screen.getByTestId('pick-label.owner-plural'));
    fireEvent.click(screen.getByTestId('pick-label.reviewer-plural'));
    fireEvent.click(screen.getByTestId('pick-label.expert-plural'));
    fireEvent.click(screen.getByTestId('pick-label.domain-plural'));
    fireEvent.click(screen.getByTestId('pick-label.related-metric-plural'));
    fireEvent.click(screen.getByTestId('create-button'));

    await waitFor(() =>
      expect(createMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          owners: [expect.objectContaining({ id: 'owner-id', type: 'team' })],
          reviewers: [
            expect.objectContaining({ id: 'reviewer-id', type: 'user' }),
          ],
          experts: ['expert'],
          domains: ['finance'],
          relatedMetrics: ['finance.revenue'],
        })
      )
    );
  });

  it('keeps the form visible and announces a backend error for retry', async () => {
    (createMetric as jest.Mock).mockRejectedValue(new Error('unavailable'));
    renderPage();
    enterRequiredFields();
    fireEvent.click(screen.getByTestId('create-button'));

    await waitFor(() => expect(showErrorToast).toHaveBeenCalled());

    expect(screen.getByTestId('add-metric-container')).toBeInTheDocument();
    expect(screen.getByTestId('create-button')).not.toBeDisabled();
  });

  it('blocks an empty name with an accessible validation message', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('create-button'));

    expect(await screen.findAllByText('label.field-required')).toHaveLength(2);
    expect(createMetric).not.toHaveBeenCalled();
  });

  it('requires an expression before submitting', async () => {
    renderPage();
    fireEvent.change(screen.getByTestId('name'), {
      target: { value: 'gross_margin_rate' },
    });
    fireEvent.click(screen.getByTestId('create-button'));

    expect(await screen.findByText('label.field-required')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /label.code/ })).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(createMetric).not.toHaveBeenCalled();
  });

  it('requires a custom unit when Unit is Other', async () => {
    renderPage();
    enterRequiredFields();
    fireEvent.click(
      screen.getByRole('button', { name: /label.unit-of-measurement/ })
    );
    fireEvent.click(await screen.findByRole('option', { name: 'label.other' }));
    fireEvent.click(screen.getByTestId('create-button'));

    expect(await screen.findByText('label.field-required')).toBeInTheDocument();
    expect(screen.getByTestId('custom-unit')).toHaveAttribute(
      'aria-invalid',
      'true'
    );
    expect(createMetric).not.toHaveBeenCalled();
  });

  it('keeps the original creation error when compensating group deletion also fails', async () => {
    const metricError = new Error('metric failed');
    (createMetric as jest.Mock).mockRejectedValue(metricError);
    (deleteMetricGroup as jest.Mock).mockRejectedValue(
      new Error('cleanup failed')
    );
    renderPage();
    enterRequiredFields();
    fireEvent.click(screen.getByTestId('pick-new-group'));
    fireEvent.click(screen.getByTestId('create-button'));

    await waitFor(() =>
      expect(deleteMetricGroup).toHaveBeenCalledWith('new-group-id', true)
    );

    expect(showErrorToast).toHaveBeenCalledWith(metricError);
  });
});
