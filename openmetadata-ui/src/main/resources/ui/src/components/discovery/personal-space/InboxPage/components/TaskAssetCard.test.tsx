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
import { MemoryRouter } from 'react-router-dom';
import { Task } from '../../../../../generated/entity/tasks/task';
import TaskAssetCard from './TaskAssetCard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('./TaskStatTiles', () => ({
  __esModule: true,
  default: () => <div data-testid="task-stat-tiles" />,
}));

const task = {
  id: 't1',
  about: {
    id: 'e1',
    type: 'table',
    name: 'dim_customers',
    displayName: 'dim_customers',
    fullyQualifiedName: 'snowflake_prod.ANALYTICS.CORE.dim_customers',
  },
} as unknown as Task;

const renderCard = (props: Partial<Parameters<typeof TaskAssetCard>[0]>) =>
  render(
    <MemoryRouter>
      <TaskAssetCard isLoading={false} task={task} {...props} />
    </MemoryRouter>
  );

describe('TaskAssetCard', () => {
  // The name is the way to the asset; no separate "Open asset" button.
  it("links the asset's name to its page", () => {
    renderCard({});

    const link = screen.getByTestId('task-open-asset');

    expect(link).toHaveTextContent('dim_customers');
    expect(link).toHaveAttribute(
      'href',
      '/table/snowflake_prod.ANALYTICS.CORE.dim_customers'
    );
    expect(screen.queryByText('label.open-asset')).not.toBeInTheDocument();
  });

  it('names the asset type and where it lives', () => {
    renderCard({});

    expect(
      screen.getByText('Table · snowflake_prod.ANALYTICS.CORE')
    ).toBeInTheDocument();
  });

  it('renders nothing for a task about no entity', () => {
    const { container } = renderCard({
      task: { id: 't2' } as unknown as Task,
    });

    expect(container).toBeEmptyDOMElement();
  });
});
