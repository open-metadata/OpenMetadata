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
import MetricCustomPropertyValue from './MetricCustomPropertyValue.component';

describe('MetricCustomPropertyValue', () => {
  it.each([null, undefined, '', []])(
    'renders a localized empty value for %p',
    (value) => {
      render(<MetricCustomPropertyValue value={value} />);

      expect(screen.getByText('label.empty-dash')).toBeInTheDocument();
    }
  );

  it('formats primitive values without coercing structures', () => {
    const { rerender } = render(<MetricCustomPropertyValue value />);

    expect(screen.getByText('label.true')).toBeInTheDocument();

    rerender(<MetricCustomPropertyValue value={1234} />);

    expect(screen.getByText((1234).toLocaleString())).toBeInTheDocument();

    rerender(<MetricCustomPropertyValue value="reviewed" />);

    expect(screen.getByText('reviewed')).toBeInTheDocument();
  });

  it('renders objects and arrays as readable JSON', () => {
    const { rerender } = render(
      <MetricCustomPropertyValue value={{ warning: 75 }} />
    );

    expect(screen.getByText(/"warning": 75/)).toBeInTheDocument();
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();

    rerender(<MetricCustomPropertyValue value={['daily', 'weekly']} />);

    expect(screen.getByText(/"daily"/)).toBeInTheDocument();
  });
});
