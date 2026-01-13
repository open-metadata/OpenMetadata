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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { postKillIngestionPipelineById } from '../../../rest/ingestionPipelineAPI';
import KillIngestionModal from './KillIngestionPipelineModal';
import { KillIngestionModalProps } from './KillIngestionPipelineModal.interface';

const mockHandleClose = jest.fn();
const mockUpdateWorkflows = jest.fn();

const mockProps: KillIngestionModalProps = {
  pipelineId: 'bb2ee1a9-653f-4925-a70c-fdbb3abc2d2c',
  pipelineName: 'MyUnsplash_Service_metadata',
  isModalOpen: true,
  onClose: mockHandleClose,
  onIngestionWorkflowsUpdate: mockUpdateWorkflows,
};

jest.mock('../../../rest/ingestionPipelineAPI', () => ({
  postKillIngestionPipelineById: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

describe('Test Kill Ingestion Modal component', () => {
  it('Should render the component', async () => {
    render(<KillIngestionModal {...mockProps} />);

    const container = await screen.findByTestId('kill-modal');
    const body = await screen.findByTestId('kill-modal-body');
    const cancelButton = await screen.findByText('label.cancel');
    const confirmButton = await screen.findByText('label.confirm');

    expect(container).toBeInTheDocument();
    expect(body).toBeInTheDocument();
    expect(confirmButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
  });

  it('Should close modal on click of cancel button', async () => {
    render(<KillIngestionModal {...mockProps} />);

    const cancelButton = await screen.findByText('label.cancel');

    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);

    expect(mockHandleClose).toHaveBeenCalled();
  });

  it('Should call kill api on click of confirm button', async () => {
    render(<KillIngestionModal {...mockProps} />);

    const confirmButton = await screen.findByText('label.confirm');

    expect(confirmButton).toBeInTheDocument();

    fireEvent.click(confirmButton);

    expect(postKillIngestionPipelineById).toHaveBeenCalledWith(
      mockProps.pipelineId
    );
  });

  it('Should call onIngestionWorkflowsUpdate after killing the pipeline', async () => {
    (postKillIngestionPipelineById as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ status: 200 })
    );

    await act(async () => {
      render(<KillIngestionModal {...mockProps} />);
    });

    const confirmButton = await screen.findByText('label.confirm');

    expect(confirmButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(confirmButton);
    });

    expect(mockUpdateWorkflows).toHaveBeenCalled();
  });
});
