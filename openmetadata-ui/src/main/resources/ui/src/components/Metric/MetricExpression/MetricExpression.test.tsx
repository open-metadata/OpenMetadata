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
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { Language, Metric } from '../../../generated/entity/data/metric';
import MetricExpression from './MetricExpression';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { entity?: string }) => {
      const labels: Record<string, string> = {
        'label.cancel': 'Cancel',
        'label.code': 'Code',
        'label.expression': 'Expression',
        'label.language': 'Language',
        'label.update': 'Update',
      };

      return key === 'label.edit-entity'
        ? `Edit ${options?.entity}`
        : labels[key] ?? key;
    },
  }),
}));

const metric = {
  id: 'metric-id',
  name: 'gross_margin',
  metricExpression: {
    code: 'SUM(revenue) - SUM(cost)',
    language: Language.SQL,
  },
} as Metric;

describe('MetricExpression', () => {
  it('renders the language and expression without execution or preview controls', () => {
    render(<MetricExpression canEdit metric={metric} onUpdate={jest.fn()} />);

    expect(screen.getByText(Language.SQL)).toBeInTheDocument();
    expect(screen.getByText('Expression')).toBeInTheDocument();
    expect(screen.getByText('SUM(revenue) - SUM(cost)')).toBeInTheDocument();
    expect(screen.getByTestId('metric-expression-panel')).toHaveClass(
      'tw:overflow-hidden',
      'tw:border',
      'tw:border-secondary'
    );
    expect(screen.getByTestId('metric-expression-header')).toHaveClass(
      'tw:bg-primary'
    );
    expect(screen.getByTestId('metric-expression-language')).toHaveClass(
      'tw:font-mono',
      'tw:uppercase',
      'tw:tracking-wide'
    );
    expect(screen.getByTestId('metric-expression-code')).toHaveClass(
      'tw:bg-secondary',
      'tw:font-mono'
    );
    expect(screen.queryByText(/preview/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/run/i)).not.toBeInTheDocument();
  });

  it('renders the inset expression panel without a second card when embedded', () => {
    render(<MetricExpression isEmbedded metric={metric} />);

    expect(screen.getByTestId('code-component').tagName).toBe('SECTION');
    expect(screen.getByTestId('metric-expression-panel')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('metric-expression-header')).getByText(
        'Expression'
      )
    ).toBeInTheDocument();
  });

  it('does not expose editing without permission or for a deleted metric', () => {
    const { rerender } = render(
      <MetricExpression metric={metric} onUpdate={jest.fn()} />
    );

    expect(
      screen.queryByRole('button', { name: /edit expression/i })
    ).not.toBeInTheDocument();

    rerender(
      <MetricExpression
        canEdit
        metric={{ ...metric, deleted: true }}
        onUpdate={jest.fn()}
      />
    );

    expect(
      screen.queryByRole('button', { name: /edit expression/i })
    ).not.toBeInTheDocument();
  });

  it('stays read-only when no update callback is supplied', () => {
    render(<MetricExpression canEdit metric={metric} />);

    expect(screen.getByText('SUM(revenue) - SUM(cost)')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /edit expression/i })
    ).not.toBeInTheDocument();
  });

  it('updates the expression and returns to read mode', async () => {
    const onUpdate = jest.fn().mockResolvedValue(undefined);
    render(<MetricExpression canEdit metric={metric} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByRole('button', { name: /edit expression/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /code/i }), {
      target: { value: 'SUM(profit)' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update/i }));

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          metricExpression: expect.objectContaining({ code: 'SUM(profit)' }),
        }),
        'metricExpression'
      )
    );

    expect(
      screen.getByRole('button', { name: /edit expression/i })
    ).toBeInTheDocument();
  });

  it('keeps the editor open after a failed update so the draft is not lost', async () => {
    const onUpdate = jest.fn().mockRejectedValue(new Error('save failed'));
    render(<MetricExpression canEdit metric={metric} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByRole('button', { name: /edit expression/i }));
    fireEvent.click(screen.getByRole('button', { name: /update/i }));

    await waitFor(() => expect(onUpdate).toHaveBeenCalled());

    expect(screen.getByRole('textbox', { name: /code/i })).toBeInTheDocument();
  });

  it('cancels editing without saving', () => {
    const onUpdate = jest.fn();
    render(<MetricExpression canEdit metric={metric} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByRole('button', { name: /edit expression/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /code/i }), {
      target: { value: 'discard me' },
    });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('SUM(revenue) - SUM(cost)')).toBeInTheDocument();
  });
});
