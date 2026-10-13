/*
 *  Copyright 2023 Collate.
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
import TotalEntityInsightSummary from './TotalEntityInsightSummary.component';

const mockProps = {
  total: 20,
  relativePercentage: 50,
  selectedDays: 7,
  entities: ['Table', 'Topic'],
  latestData: { Table: 30, Topic: 20 },
};

jest.mock('./CustomStatistic', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>CustomStatistic.component</div>);
});
jest.mock('./EntitySummaryProgressBar.component', () => {
  return jest.fn().mockImplementation(({ entity, strokeColor }) => (
    <div data-color={strokeColor} data-testid={'summary-' + entity}>
      EntitySummaryProgressBar.component
    </div>
  ));
});
jest.mock('../common/SearchBarComponent/SearchBar.component', () =>
  jest
    .fn()
    .mockImplementation(({ onSearch }) => (
      <input
        aria-label="search"
        data-testid="searchbar"
        onChange={(e) => onSearch(e.target.value)}
      />
    ))
);

describe('TotalEntityInsightSummary component', () => {
  it('Component should render', async () => {
    render(<TotalEntityInsightSummary {...mockProps} />);

    expect(
      await screen.findByTestId('total-entity-insight-summary-container')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('CustomStatistic.component')
    ).toBeInTheDocument();
    expect(
      await screen.findAllByText('EntitySummaryProgressBar.component')
    ).toHaveLength(mockProps.entities.length);
  });

  it('colours entities by rank, whatever the search shows', () => {
    render(
      <TotalEntityInsightSummary
        allowFilter
        {...mockProps}
        entities={['table', 'topic']}
        latestData={{ table: 1, topic: 5 }}
      />
    );

    expect(screen.getByTestId('summary-Topic')).toHaveAttribute(
      'data-color',
      '#100000'
    );
    expect(screen.getByTestId('summary-Table')).toHaveAttribute(
      'data-color',
      '#200000'
    );

    fireEvent.change(screen.getByTestId('searchbar'), {
      target: { value: 'tab' },
    });

    expect(screen.queryByTestId('summary-Topic')).not.toBeInTheDocument();
    expect(screen.getByTestId('summary-Table')).toHaveAttribute(
      'data-color',
      '#200000'
    );
  });
});
