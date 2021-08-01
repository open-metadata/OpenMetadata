import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import { reportDetails } from '../../pages/reports/index.mock';
import ReportCard from './ReportCard';

describe('Test ReportCard Component', () => {
  it('Renders the proper HTML for a report card', () => {
    const { container } = render(<ReportCard reportDetails={reportDetails} />);
    const dataNameElement = getByTestId(container, 'data-name');
    const likeCountElement = getByTestId(container, 'like-button');
    const ellipsisSvg = getByTestId(container, 'ellipsis');
    const descriptionElement = getByTestId(container, 'desc-container');
    const queryElement = getByTestId(container, 'query-container');

    expect(dataNameElement.textContent).toBe('hourly_sales_figures ');
    expect(likeCountElement).toBeInTheDocument();
    expect(ellipsisSvg).toBeInTheDocument();
    expect(descriptionElement).toBeInTheDocument();
    expect(queryElement).toBeInTheDocument();
  });
});
