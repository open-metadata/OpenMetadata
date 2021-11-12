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

import { findByTestId, render } from '@testing-library/react';
import React from 'react';
import MyDataPageComponent from './MyDataPage.component';

jest.mock('../../components/MyData/MyData.component', () => {
  return jest
    .fn()
    .mockReturnValue(<p data-testid="my-data-component">Mydata component</p>);
});

jest.mock('../../axiosAPIs/miscAPI', () => ({
  searchData: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {
        aggregations: {
          'sterms#Service': {
            buckets: [],
          },
        },
        hits: [],
      },
    })
  ),
}));

jest.mock('../../utils/ServiceUtils', () => ({
  getAllServices: jest.fn().mockImplementation(() => Promise.resolve(['test'])),
  getEntityCountByService: jest.fn().mockReturnValue({
    tableCount: 0,
    topicCount: 0,
    dashboardCount: 0,
    pipelineCount: 0,
  }),
}));

describe('Test MyData page component', () => {
  it('Component should render', async () => {
    const { container } = render(<MyDataPageComponent />);

    const myData = await findByTestId(container, 'my-data-component');

    expect(myData).toBeInTheDocument();
  });
});
