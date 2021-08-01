import {
  fireEvent,
  getAllByTestId,
  getByTestId,
  render,
} from '@testing-library/react';
import React from 'react';
import { issues } from '../../pages/my-data-details/index.mock';
import IssuesTab from './IssuesTab';

describe('Test IssuesTab Component', () => {
  it('Render the proper number of open issues on loading the component', () => {
    const { container } = render(<IssuesTab issues={issues} />);
    const issueRows = getAllByTestId(container, 'issue-row');

    expect(issueRows.length).toBe(2);
  });

  it('Renders the closed issues on clicking the closed button', () => {
    const { container } = render(<IssuesTab issues={issues} />);
    const openIssues = getAllByTestId(container, 'issue-row');

    expect(openIssues.length).toBe(2);

    const closeButton = getByTestId(container, 'closed-button');
    fireEvent.click(closeButton);
    const closedIssues = getAllByTestId(container, 'issue-row');

    expect(closedIssues.length).toBe(1);
  });
});
