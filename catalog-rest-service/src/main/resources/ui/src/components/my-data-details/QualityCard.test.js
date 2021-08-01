import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import QualityCard from './QualityCard';

describe('Test QualityCard Component', () => {
  it('Render the proper details passed to the component', () => {
    const lastRunsData = ['Success', 'Failed', 'Unknown', 'Success', 'Success'];
    const { container } = render(
      <QualityCard
        heading="Freshness"
        lastRunResults="June 21, 2020 05:00 AM"
        lastRunsData={lastRunsData}
      />
    );
    const statusIcon = getByTestId(container, 'run-status-icon');

    expect(statusIcon).toBeInTheDocument();

    const heading = getByTestId(container, 'quality-card-heading');

    expect(heading.textContent).toBe('Freshness');

    const lastRunsStatusContainer = getByTestId(
      container,
      'last-run-status-container'
    );

    expect(lastRunsStatusContainer).toBeInTheDocument();

    const lastRunResults = getByTestId(container, 'last-run-results');

    expect(lastRunResults.textContent).toBe('June 21, 2020 05:00 AM');
  });
});
