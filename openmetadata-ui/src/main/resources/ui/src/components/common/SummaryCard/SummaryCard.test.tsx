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
import { SummaryCard } from './SummaryCard.component';
import { SummaryCardProps } from './SummaryCard.interface';

const mockProps: SummaryCardProps = {
  title: 'title',
  value: 10,
  total: 100,
};

describe('SummaryCard component', () => {
  it('component should render', async () => {
    render(<SummaryCard {...mockProps} />);

    expect(
      await screen.findByTestId('summary-card-container')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('summary-card-title')).toBeInTheDocument();
    expect(
      await screen.findByTestId('summary-card-description')
    ).toBeInTheDocument();
    expect(await screen.findByRole('presentation')).toBeInTheDocument();
  });

  it('should not render progress bar, if showProgressBar is false', async () => {
    render(<SummaryCard {...mockProps} showProgressBar={false} />);

    expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
  });

  it('should not render skeleton loader, if isLoading is true', async () => {
    render(<SummaryCard {...mockProps} isLoading />);

    expect(await screen.findByTestId('skeleton-loading')).toBeInTheDocument();
  });

  it('should render progress bar based on type', async () => {
    render(<SummaryCard {...mockProps} type="success" />);

    const progressBar = await screen.findByTestId('progress-bar');

    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveClass('success');
  });

  it('should render title and description based on props', async () => {
    render(<SummaryCard title="summary title" total={0} value="description" />);

    const title = await screen.findByTestId('summary-card-title');
    const description = await screen.findByTestId('summary-card-description');

    expect(title).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(title.textContent).toStrictEqual('summary title');
    expect(description.textContent).toStrictEqual('description');
  });

  it("label should be inverse, if 'inverseLabel' is true", async () => {
    render(<SummaryCard {...mockProps} inverseLabel />);

    const label = await screen.findByTestId('summary-card-label');

    expect(label).toHaveClass('inverse-label');
  });

  it("should render title icon, if 'titleIcon' is provided", async () => {
    render(
      <SummaryCard
        {...mockProps}
        titleIcon={<span data-testid="title-icon">icon</span>}
      />
    );

    expect(await screen.findByTestId('title-icon')).toBeInTheDocument();
  });

  it("should render card background based on 'cardBackgroundClass'", async () => {
    render(<SummaryCard {...mockProps} cardBackgroundClass="bg-success" />);

    const container = await screen.findByTestId('summary-card-container');

    expect(container).toHaveClass('bg-success');
  });
});
