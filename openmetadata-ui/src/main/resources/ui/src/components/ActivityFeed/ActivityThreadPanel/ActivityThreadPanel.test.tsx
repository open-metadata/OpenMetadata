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

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import ReactDOM from 'react-dom';
import { MemoryRouter } from 'react-router-dom';
import ActivityThreadPanel from './ActivityThreadPanel';

jest.mock('./ActivityThreadPanelBody', () =>
  jest.fn(({ view }) => <p data-testid={`panel-${view}`}>{view}</p>)
);

describe('ActivityThreadPanel', () => {
  beforeAll(() => {
    ReactDOM.createPortal = jest.fn((element) => element as React.ReactPortal);
  });

  it('opens on conversations and can switch to dedicated tasks', async () => {
    render(
      <MemoryRouter>
        <ActivityThreadPanel open threadLink="<#E::table::table>" />
      </MemoryRouter>
    );

    expect(
      await screen.findByTestId('panel-conversations')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText('label.task-plural'));

    expect(await screen.findByTestId('panel-tasks')).toBeInTheDocument();
  });
});
