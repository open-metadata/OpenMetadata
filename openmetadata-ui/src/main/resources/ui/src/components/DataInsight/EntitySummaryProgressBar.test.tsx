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
import { render, screen } from '@testing-library/react';
import EntitySummaryProgressBar from './EntitySummaryProgressBar.component';

const mockProps = {
  progress: 20,
  entity: 'Table',
  latestData: { Table: 20 },
};

describe('EntitySummaryProgressBar component', () => {
  it('Component should render', async () => {
    render(<EntitySummaryProgressBar {...mockProps} />);

    expect(
      await screen.findByTestId('entity-summary-container')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('entity-name')).toBeInTheDocument();
    expect(await screen.findByTestId('entity-value')).toBeInTheDocument();
    expect(await screen.findByTestId('progress-bar')).toBeInTheDocument();
  });

  it('Should not pluralize name if pluralize is false', async () => {
    render(<EntitySummaryProgressBar {...mockProps} pluralize={false} />);

    expect(
      (await screen.findByTestId('entity-name')).textContent
    ).toStrictEqual(mockProps.entity);
  });

  it('Should render label if provided', async () => {
    render(<EntitySummaryProgressBar {...mockProps} label="test" />);

    expect(
      (await screen.findByTestId('entity-value')).textContent
    ).toStrictEqual('test');
  });
});
