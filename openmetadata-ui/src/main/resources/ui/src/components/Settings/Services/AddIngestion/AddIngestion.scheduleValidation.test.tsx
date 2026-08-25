/*
 *  Copyright 2025 Collate.
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

jest.mock('../../../../utils/i18next/i18nextUtil', () => ({
  getCurrentLocaleForConstrue: jest.fn().mockReturnValue('en-US'),
}));

// cronstrue is deliberately NOT mocked here: the "less than an hour" guard in
// cronValidator works off its human readable description, so stubbing it would
// silently disable the very check these tests cover.

import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { FormSubmitType } from '../../../../enums/form.enum';
import { ServiceCategory } from '../../../../enums/service.enum';
import { PipelineType } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import AddIngestion from './AddIngestion.component';
import {
  AddIngestionHandle,
  AddIngestionProps,
} from './IngestionWorkflow.interface';

jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ ingestionFQN: '' }),
}));

jest.mock('../Ingestion/IngestionWorkflowForm/IngestionWorkflowForm', () =>
  jest.fn().mockImplementation(() => <div>Ingestion workflow form</div>)
);

jest.mock('../AddService/ServiceFlowStepper/ServiceFlowStepper', () =>
  jest.fn().mockImplementation(() => <div>ServiceFlowStepper</div>)
);

jest.mock(
  '../../../Modals/DeployIngestionLoaderModal/DeployIngestionLoaderModal',
  () =>
    jest.fn().mockImplementation(() => <div>DeployIngestionLoaderModal</div>)
);

const mockOnAddIngestionSave = jest.fn().mockResolvedValue(undefined);

const mockProps: AddIngestionProps = {
  activeIngestionStep: 2,
  setActiveIngestionStep: jest.fn(),
  serviceData: { name: 'serviceName', id: 'service-id' },
  handleCancelClick: jest.fn(),
  serviceCategory: ServiceCategory.DATABASE_SERVICES,
  onAddIngestionSave: mockOnAddIngestionSave,
  handleViewServiceClick: jest.fn(),
  pipelineType: PipelineType.Metadata,
  heading: 'add ingestion',
  status: FormSubmitType.ADD,
  onFocus: jest.fn(),
  hideFooter: true,
};

describe('AddIngestion schedule validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not save the pipeline while the custom cron is empty', async () => {
    const ref = createRef<AddIngestionHandle>();
    render(<AddIngestion {...mockProps} ref={ref} />);

    fireEvent.click(screen.getByTestId('frequency-custom'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });

    expect(screen.getByTestId('custom-cron-error')).toBeInTheDocument();

    // This is what the page footer does for the "Add & Deploy" button.
    await act(async () => {
      ref.current?.submit();
    });

    expect(mockOnAddIngestionSave).not.toHaveBeenCalled();
  });

  it('should not save the pipeline while the custom cron is malformed', async () => {
    const ref = createRef<AddIngestionHandle>();
    render(<AddIngestion {...mockProps} ref={ref} />);

    fireEvent.click(screen.getByTestId('frequency-custom'));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '0 0 * *' },
    });

    await act(async () => {
      ref.current?.submit();
    });

    expect(mockOnAddIngestionSave).not.toHaveBeenCalled();
  });

  it('should not save the pipeline for a cron more frequent than an hour', async () => {
    const ref = createRef<AddIngestionHandle>();
    render(<AddIngestion {...mockProps} ref={ref} />);

    fireEvent.click(screen.getByTestId('frequency-custom'));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '*/5 * * * *' },
    });

    await act(async () => {
      ref.current?.submit();
    });

    expect(mockOnAddIngestionSave).not.toHaveBeenCalled();
  });

  it('should save the pipeline once the schedule is valid', async () => {
    const ref = createRef<AddIngestionHandle>();
    render(<AddIngestion {...mockProps} ref={ref} />);

    fireEvent.click(screen.getByTestId('frequency-custom'));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '0 3 * * *' },
    });

    await act(async () => {
      ref.current?.submit();
    });

    expect(mockOnAddIngestionSave).toHaveBeenCalled();
  });
});
