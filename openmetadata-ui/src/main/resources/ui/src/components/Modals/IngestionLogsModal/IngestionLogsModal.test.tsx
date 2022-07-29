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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { PipelineType } from '../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import IngestionLogsModal from './IngestionLogsModal';

const mockProps = {
  pipelineId: 'bb2ee1a9-653f-4925-a70c-fdbb3abc2d2c',
  pipelinName: 'MyUnsplash_Service_metadata',
  pipelineType: PipelineType.Metadata,
  isModalOpen: true,
  onClose: jest.fn(),
};

jest.mock('../../../axiosAPIs/ingestionPipelineAPI', () => ({
  getIngestionPipelineLogById: jest.fn().mockImplementation(() =>
    // eslint-disable-next-line @typescript-eslint/camelcase
    Promise.resolve({ data: { ingestion_task: 'logs' } })
  ),
}));

jest.mock('../../../utils/ingestionutils', () => ({
  gzipToStringConverter: jest.fn().mockImplementation(() => 'logs'),
}));

jest.mock('../../buttons/CopyToClipboardButton/CopyToClipboardButton', () =>
  jest.fn().mockReturnValue(<button data-testid="copy">copy</button>)
);

describe('Test Ingestion Logs Modal component', () => {
  it('Should render the component', async () => {
    render(<IngestionLogsModal {...mockProps} />);

    const container = await screen.findByTestId('logs-modal');
    const logsBody = await screen.findByTestId('logs-body');
    const jumpToEndButton = await screen.findByTestId('jump-to-end-button');

    expect(container).toBeInTheDocument();

    expect(logsBody).toBeInTheDocument();

    expect(jumpToEndButton).toBeInTheDocument();
  });
});
