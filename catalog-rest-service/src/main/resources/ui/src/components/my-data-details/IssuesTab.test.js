/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import {
  fireEvent,
  getAllByTestId,
  getByTestId,
  render,
} from '@testing-library/react';
import React from 'react';
import { issues } from '../my-data-details/DatasetDetails.mock';
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
