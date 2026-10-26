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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ServiceCategory } from '../../../../../enums/service.enum';
import { PipelineType } from '../../../../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import {
  IngestionWorkflowData,
  IngestionWorkflowFormProps,
} from '../../../../../interface/service.interface';
import IngestionWorkflowForm from './IngestionWorkflowForm';

const DBT_WORKFLOW_DATA = {
  name: 'dbt_agent',
  type: 'DBT',
  dbtConfigSource: {
    dbtConfigType: 'local',
    dbtManifestFilePath: '/dbt/manifest.json',
  },
  catalogMapping: { bq_catalog: 'my-gcp-project' },
} as unknown as IngestionWorkflowData;

const renderDbtForm = (onChange = jest.fn(), onSubmit = jest.fn()) =>
  render(
    <IngestionWorkflowForm
      okText="Submit"
      pipeLineType={PipelineType.Dbt}
      serviceCategory={ServiceCategory.DATABASE_SERVICES}
      workflowData={DBT_WORKFLOW_DATA}
      onCancel={jest.fn()}
      onChange={onChange}
      onFocus={jest.fn()}
      onSubmit={onSubmit}
    />
  );

describe('IngestionWorkflowForm dbt catalogMapping', () => {
  it('renders the catalog mapping under its own title with the saved entries', async () => {
    renderDbtForm();

    expect(await screen.findByText('Catalog Mapping')).toBeInTheDocument();
    expect(screen.getByDisplayValue('bq_catalog')).toBeInTheDocument();
    expect(screen.getByDisplayValue('my-gcp-project')).toBeInTheDocument();
    // the key is the editable input beside the value, not a label above it
    expect(screen.queryByText('bq_catalog')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'bq_catalog' })).toHaveValue(
      'my-gcp-project'
    );
    expect(screen.getByRole('textbox', { name: 'label.key' })).toHaveValue(
      'bq_catalog'
    );
  });

  it('adds a catalog entry to the workflow data', async () => {
    const onChange = jest.fn();
    renderDbtForm(onChange);
    await screen.findByText('Catalog Mapping');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.add-entity' }));
    });

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const { catalogMapping } = onChange.mock.calls.at(-1)[0];

    expect(catalogMapping).toEqual(
      expect.objectContaining({ bq_catalog: 'my-gcp-project' })
    );
    expect(Object.keys(catalogMapping)).toHaveLength(2);
    // RJSF's visible default, so an untouched row is noticed before it is saved
    expect(catalogMapping.newKey).toBe('New Value');
  });

  it('saves the catalog mapping without a row that was added but never filled in', async () => {
    const onSubmit = jest.fn();
    const { container } = renderDbtForm(jest.fn(), onSubmit);
    await screen.findByText('Catalog Mapping');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'label.add-entity' }));
    });
    await act(async () => {
      fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    });

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());

    expect(onSubmit.mock.calls[0][0].catalogMapping).toEqual({
      bq_catalog: 'my-gcp-project',
    });
  });
});

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
