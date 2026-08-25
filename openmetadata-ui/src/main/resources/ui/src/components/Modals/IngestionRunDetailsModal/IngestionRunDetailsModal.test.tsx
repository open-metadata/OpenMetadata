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

import { render, screen } from '@testing-library/react';
import { mockPipelineStatus } from '../../../mocks/Ingestion.mock';
import IngestionRunDetailsModal from './IngestionRunDetailsModal';

const mockHandleCancel = jest.fn();

describe('IngestionRunDetailsModal', () => {
  it('should show no data placeholder when no step summary is not present', () => {
    render(<IngestionRunDetailsModal handleCancel={mockHandleCancel} />);

    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('should show proper data in the table when step summary is present', () => {
    render(
      <IngestionRunDetailsModal
        handleCancel={mockHandleCancel}
        pipelineStatus={mockPipelineStatus}
      />
    );

    expect(
      screen.getByTestId(
        `step-summary-name-${mockPipelineStatus.status[0].name}`
      )
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(
        `step-summary-name-${mockPipelineStatus.status[1].name}`
      )
    ).toBeInTheDocument();
  });
});
