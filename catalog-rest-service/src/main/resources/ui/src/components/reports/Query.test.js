import { getByTestId, render } from '@testing-library/react';
import React from 'react';
import Query from './Query';

describe('Test ReportCard Component', () => {
  it('Renders the proper HTML for a report card', () => {
    const { container } = render(<Query query="test query" />);
    const queryElement = getByTestId(container, 'query');

    expect(queryElement.textContent).toBe('test query');
  });
});
