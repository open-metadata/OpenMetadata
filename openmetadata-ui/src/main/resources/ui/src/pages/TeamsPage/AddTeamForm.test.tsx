/*
 *  Copyright 2023 Collate.
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
import { render } from '@testing-library/react';
import React from 'react';
import { TeamType } from '../../generated/entity/teams/team';
import AddTeamForm from './AddTeamForm';

const mockCancel = jest.fn();
const mockSave = jest.fn();

describe('AddTeamForm component', () => {
  it('should render form with required fields', () => {
    const { getByTestId } = render(
      <AddTeamForm
        visible
        isLoading={false}
        parentTeamType={TeamType.Organization}
        onCancel={mockCancel}
        onSave={mockSave}
      />
    );

    expect(getByTestId('name')).toBeInTheDocument();
    expect(getByTestId('email')).toBeInTheDocument();
    expect(getByTestId('editor')).toBeInTheDocument();
    expect(getByTestId('team-selector')).toBeInTheDocument();
  });
});
