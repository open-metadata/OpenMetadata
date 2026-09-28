/*
 *  Copyright 2025 Collate.
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
import IngestionNameCard from './IngestionNameCard';

const mockOnDisplayNameChange = jest.fn();

const mockProps = {
  displayName: 'agent name',
  onDisplayNameChange: mockOnDisplayNameChange,
};

describe('IngestionNameCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the name field', () => {
    render(<IngestionNameCard {...mockProps} />);

    expect(screen.getByTestId('ingestion-name-card')).toBeInTheDocument();
    expect(screen.getByTestId('ingestion-display-name')).toBeInTheDocument();
  });

  it('should propagate a name change', () => {
    render(<IngestionNameCard {...mockProps} />);

    fireEvent.change(screen.getByTestId('ingestion-display-name'), {
      target: { value: 'renamed agent' },
    });

    expect(mockOnDisplayNameChange).toHaveBeenCalled();
  });

  // The card is a container: fields are composed in by the caller, so adding
  // one (tags, tier, …) costs no props here.
  it('should render composed entity fields', () => {
    render(
      <IngestionNameCard {...mockProps}>
        <div data-testid="composed-field" />
      </IngestionNameCard>
    );

    expect(screen.getByTestId('composed-field')).toBeInTheDocument();
  });

  it('should render without any composed field', () => {
    render(<IngestionNameCard {...mockProps} />);

    expect(screen.queryByTestId('composed-field')).not.toBeInTheDocument();
  });
});
