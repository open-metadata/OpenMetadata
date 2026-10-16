/*
 *  Copyright 2026 Collate.
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
import { ServiceCategory } from '../../../../../enums/service.enum';
import { PipelineType } from '../../../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import {
  IngestionWorkflowData,
  IngestionWorkflowFormProps,
} from '../../../../../interface/service.interface';
import IngestionWorkflowForm from './IngestionWorkflowForm';

type ServiceData = IngestionWorkflowFormProps['serviceData'];

const renderProfilerForm = (serviceData: ServiceData) =>
  render(
    <IngestionWorkflowForm
      hideFooter
      pipeLineType={PipelineType.Profiler}
      serviceCategory={ServiceCategory.DATABASE_SERVICES}
      serviceData={serviceData}
      workflowData={{} as IngestionWorkflowData}
      onCancel={jest.fn()}
      onFocus={jest.fn()}
      onSubmit={jest.fn()}
    />
  );

const getAutoPartitionField = async () => {
  fireEvent.click(
    await screen.findByTestId('ingestion-section-advanced-toggle')
  );

  return (await screen.findByText('Enable Auto Partition Detection')).closest(
    '[data-field-name="enableAutoPartitionDetection"]'
  );
};

describe('IngestionWorkflowForm auto partition detection', () => {
  it('shows the setting for services that support auto partition detection', async () => {
    renderProfilerForm({
      connection: { config: { supportsAutoPartitionDetection: true } },
    } as ServiceData);

    expect(await getAutoPartitionField()).not.toHaveClass('tw:hidden');
  });

  it('hides the setting for services that do not support auto partition detection', async () => {
    renderProfilerForm({
      connection: { config: {} },
    } as ServiceData);

    expect(await getAutoPartitionField()).toHaveClass('tw:hidden');
  });
});
