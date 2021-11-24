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
