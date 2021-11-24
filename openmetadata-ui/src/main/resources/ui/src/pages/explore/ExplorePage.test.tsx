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

import { findByText, render } from '@testing-library/react';
import React from 'react';
import ExplorePage from './ExplorePage.component';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => ({ searchQuery: '' })),
}));

jest.mock('../../components/Explore/Explore.component', () => {
  return jest.fn().mockReturnValue(<p>Explore Component</p>);
});

jest.mock('../../axiosAPIs/miscAPI', () => ({
  searchData: jest.fn().mockImplementation(() => Promise.resolve()),
}));

describe('Test Explore page', () => {
  it('Page Should render', async () => {
    const { container } = render(<ExplorePage />);

    const explorePage = await findByText(container, /Explore Component/i);

    expect(explorePage).toBeInTheDocument();
  });
});
