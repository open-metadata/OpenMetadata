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

import { render } from '@testing-library/react';
import React from 'react';
import mockData from '../../pages/users/index.mock';
import UserList from './UserList';

describe('Test User Listing Component', () => {
  it('Renders the proper HTML for user list details', async () => {
    const { findByTestId, findAllByTestId } = render(
      <UserList handleClick={jest.fn()} userList={mockData} />
    );
    const tableList = await findByTestId('user-list');
    const userList = await findAllByTestId('user');

    expect(tableList).toBeInTheDocument();
    expect(userList.length).toBe(3);
  });
});
