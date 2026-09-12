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
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { ThemeProvider } from '../../context/UntitledUIThemeProvider/theme-provider';
import KnowledgeGraphFooter from './KnowledgeGraphFooter';

const renderFooter = (
  changes: Partial<ComponentProps<typeof KnowledgeGraphFooter>> = {}
) => {
  const onChange = jest.fn();
  render(
    <ThemeProvider>
      <KnowledgeGraphFooter
        data={{ nodes: [], edges: [] }}
        details={{
          active: null,
          counts: { columns: 300, relationships: 322, coverage: 6 },
          onChange,
        }}
        expanded={[]}
        labelMode="auto"
        level={2}
        mode="knowledge-graph"
        presentation="balanced"
        onCollapse={jest.fn()}
        {...changes}>
        <span>legend</span>
      </KnowledgeGraphFooter>
    </ThemeProvider>
  );

  return onChange;
};

beforeEach(() => jest.useRealTimers());

it('carries the details tabs with their counts and opens the chosen list', async () => {
  const onChange = renderFooter();

  expect(screen.getByTestId('graph-open-columns')).toHaveTextContent(
    'label.column-plural300'
  );
  expect(screen.getByTestId('graph-open-coverage-count')).toHaveClass(
    'tw:text-utility-warning-700'
  );

  await userEvent.click(screen.getByTestId('graph-open-relationships'));

  expect(onChange).toHaveBeenCalledWith('relationships');
});

it('flags the gaps tab only while there are gaps and marks the open tab', () => {
  renderFooter({
    details: {
      active: 'coverage',
      counts: { columns: 1, relationships: 1, coverage: 0 },
      onChange: jest.fn(),
    },
  });

  expect(screen.getByTestId('graph-open-coverage')).toHaveAttribute(
    'aria-expanded',
    'true'
  );
  expect(screen.getByTestId('graph-open-coverage-count')).not.toHaveClass(
    'tw:text-utility-warning-700'
  );
  expect(screen.getByTestId('graph-footer')).toHaveTextContent(
    'label.kg-balanced-summary'
  );
});
