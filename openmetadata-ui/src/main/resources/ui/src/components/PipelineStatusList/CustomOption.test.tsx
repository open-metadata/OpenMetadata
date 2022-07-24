/*
 *  Copyright 2021 Collate
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
import React, { Fragment } from 'react';
import { OptionProps } from 'react-select';
import { StatusType } from '../../generated/entity/data/pipeline';
import CustomOption from './CustomOption';

jest.mock('../../utils/PipelineDetailsUtils', () => ({
  getStatusBadgeIcon: jest.fn().mockImplementation((status: StatusType) => {
    return status;
  }),
}));

jest.mock('react-select', () => ({
  OptionProps: {},
  components: {
    Option: jest.fn().mockImplementation(({ children }) => {
      return <Fragment>{children}</Fragment>;
    }),
  },
}));

const mockProp = {
  label: 'Successful',
};

describe('Test Custom Option Component', () => {
  it('Shoud Render Label with status badge', async () => {
    const { findByTestId } = render(
      <CustomOption {...(mockProp as OptionProps)} />
    );

    const statusBadge = await findByTestId('status-badge');
    const statusLabel = await findByTestId('status-label');

    expect(statusBadge).toBeInTheDocument();
    expect(statusLabel).toBeInTheDocument();
  });
});
