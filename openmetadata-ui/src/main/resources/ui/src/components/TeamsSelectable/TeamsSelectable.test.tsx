/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import TeamsSelectable from './TeamsSelectable';

const mockSelChange = jest.fn();

const mockProps = {
  onSelectionChange: mockSelChange,
};

jest.mock('antd', () => ({
  TreeSelect: jest
    .fn()
    .mockImplementation(({ onChange }) => (
      <div onClick={() => onChange([])}>TreeSelect.component</div>
    )),
}));

jest.mock('rest/teamsAPI', () => ({
  getTeamsHierarchy: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [],
    })
  ),
}));

describe('TeamsSelectable component test', () => {
  it('TeamsSelectable component should render properly', async () => {
    const { findByText } = render(<TeamsSelectable {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    const treeSelect = await findByText('TreeSelect.component');

    expect(treeSelect).toBeInTheDocument();
  });

  it('TeamsSelectable component should fire selection change', async () => {
    const { findByText } = render(<TeamsSelectable {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    const treeSelect = await findByText('TreeSelect.component');

    fireEvent.click(
      treeSelect,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(treeSelect).toBeInTheDocument();
    expect(mockSelChange).toHaveBeenCalled();
  });
});
