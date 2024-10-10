/*
 *  Copyright 2024 Collate.
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
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { STATUS_LABEL } from '../../../constants/constants';
import { Status } from '../../../generated/entity/applications/appRunRecord';
import StatusBadge from './StatusBadge.component';
import { StatusBadgeProps, StatusType } from './StatusBadge.interface';

describe('Test StatusBadge Component', () => {
  const defaultProps: StatusBadgeProps = {
    dataTestId: 'pipeline-status',
    label: STATUS_LABEL[Status.PartialSuccess],
    status: StatusType.PartialSuccess,
  };

  it('renders the correct label', () => {
    render(<StatusBadge {...defaultProps} />);

    // Check if the label text "Partial Success" is rendered
    expect(
      screen.getByText(STATUS_LABEL[Status.PartialSuccess])
    ).toBeInTheDocument();
  });
});
