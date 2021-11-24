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
  findAllByTestId,
  findByTestId,
  findByText,
  fireEvent,
  render,
} from '@testing-library/react';
import React from 'react';
import AddUsersModal from './AddUsersModal';

const mockCancel = jest.fn();
const mockSave = jest.fn();
const mockUserList = [
  {
    description: 'Robert Mitchell',
    href: 'href',
    id: 'id1',
    name: 'robert_mitchell6',
    type: 'user',
  },
  {
    description: 'Shane Davis',
    href: 'href',
    id: 'id2',
    name: 'shane_davis8',
    type: 'user',
  },
];

jest.mock('../../components/common/searchbar/Searchbar', () => {
  return jest.fn().mockReturnValue(<p data-testid="searchbar">Searchbar</p>);
});

jest.mock('./UserCard', () => {
  return jest.fn().mockReturnValue(<p data-testid="user-card">UserCard</p>);
});

describe('Test AddUsersModal component', () => {
  it('Component should render', async () => {
    const { container } = render(
      <AddUsersModal
        header="Adding new users"
        list={mockUserList}
        onCancel={mockCancel}
        onSave={mockSave}
      />
    );
    const modalComponent = await findByTestId(container, 'modal-container');
    const header = await findByTestId(container, 'header');
    const searchbar = await findByTestId(container, 'searchbar');
    const ctaContainer = await findByTestId(container, 'cta-container');

    expect(ctaContainer.childElementCount).toBe(2);
    expect(modalComponent).toBeInTheDocument();
    expect(header).toBeInTheDocument();
    expect(searchbar).toBeInTheDocument();
  });

  it('UserCard should be equal to length of list', async () => {
    const { container } = render(
      <AddUsersModal
        header="Adding new users"
        list={mockUserList}
        onCancel={mockCancel}
        onSave={mockSave}
      />
    );
    const userCard = await findAllByTestId(container, 'user-card');

    expect(userCard.length).toBe(mockUserList.length);
  });

  it('Onclick of Discard button, onCancel callback should called', async () => {
    const { container } = render(
      <AddUsersModal
        header="Adding new users"
        list={mockUserList}
        onCancel={mockCancel}
        onSave={mockSave}
      />
    );
    const discard = await findByText(container, /Discard/i);
    fireEvent.click(discard);

    expect(mockCancel).toBeCalledTimes(1);
  });

  it('Onclick of Save button, onSave callback should called', async () => {
    const { container } = render(
      <AddUsersModal
        header="Adding new users"
        list={mockUserList}
        onCancel={mockCancel}
        onSave={mockSave}
      />
    );
    const save = await findByText(container, /Save/i);
    fireEvent.click(save);

    expect(mockSave).toBeCalledTimes(1);
  });
});
