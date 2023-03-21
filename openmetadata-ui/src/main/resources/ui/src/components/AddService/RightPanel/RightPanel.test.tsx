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
import { act, render, screen } from '@testing-library/react';
import { ServiceCategory } from 'enums/service.enum';
import { PipelineType } from 'generated/api/services/ingestionPipelines/createIngestionPipeline';
import React from 'react';
import RightPanel, { ExcludedPipelineType } from './RightPanel';

jest.mock('components/common/rich-text-editor/RichTextEditorPreviewer', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }) => (
      <div data-testid="requirement-text">{markdown}</div>
    ))
);

jest.mock('rest/miscAPI', () => ({
  fetchMarkdownFile: jest
    .fn()
    .mockImplementation(() => Promise.resolve('markdown text')),
}));

const mockProps = {
  isIngestion: false,
  pipelineType: PipelineType.Metadata as ExcludedPipelineType,
  activeStep: 1,
  isAirflowRunning: true,
  showDeployedTitle: true,
  isUpdating: false,
  ingestionName: 'service_ingestion',
  serviceName: 'service',
  activeField: 'root_username',
  selectedServiceCategory: ServiceCategory.DATABASE_SERVICES,
  selectedService: 'Mysql',
};

describe('Right Panel Component', () => {
  it('Should render the active field doc', async () => {
    await act(async () => {
      render(<RightPanel {...mockProps} />);
    });

    const activeFieldName = screen.getByTestId('active-field-name');

    expect(activeFieldName).toBeInTheDocument();

    expect(activeFieldName).toHaveTextContent('Username');

    const activeFieldDocumentElement = screen.getByTestId('requirement-text');

    expect(activeFieldDocumentElement).toBeInTheDocument();

    expect(activeFieldDocumentElement).toHaveTextContent('markdown text');
  });

  it('Should render the current step guide if active field is empty', async () => {
    await act(async () => {
      render(<RightPanel {...mockProps} activeField={undefined} />);
    });

    expect(screen.queryByTestId('active-field-name')).not.toBeInTheDocument();

    const activeFieldDocumentElement = screen.queryByTestId('requirement-text');

    expect(activeFieldDocumentElement).not.toBeInTheDocument();

    expect(screen.getByText('label.add-a-new-service')).toBeInTheDocument();

    expect(
      screen.getByText('message.add-new-service-description')
    ).toBeInTheDocument();
  });
});
