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

import {
  findByTestId,
  findByText,
  fireEvent,
  render,
} from '@testing-library/react';
import React from 'react';
import { AddServiceModal, ServiceDataObj } from './AddServiceModal';

const mockData = {
  description: 'string',
  href: 'string',
  id: 'string',
  jdbc: { driverClass: 'string', connectionUrl: 'string' },
  name: 'string',
  serviceType: 'string',
  ingestionSchedule: { repeatFrequency: 'string', startDate: 'string' },
};

const mockOnSave = jest.fn();
const mockOnCancel = jest.fn();

const mockServiceList: Array<ServiceDataObj> = [{ name: mockData.name }];

jest.mock('../../common/editor/MarkdownWithPreview', () => {
  return jest
    .fn()
    .mockReturnValue(<p data-testid="description">MarkdownWithPreview</p>);
});

jest.mock('../../common/rich-text-editor/RichTextEditorPreviewer', () => {
  return jest
    .fn()
    .mockReturnValue(<p data-testid="description">RichTextEditorPreviewer</p>);
});

jest.mock('../../IngestionStepper/IngestionStepper.component', () => {
  return jest.fn().mockReturnValue(<div>IngestionStepper component</div>);
});

jest.mock('../../../utils/ServiceUtils', () => ({
  getIngestionTypeList: jest.fn().mockReturnValue(['bigquery']),
  getIsIngestionEnable: jest
    .fn()
    .mockImplementation((service) => service === 'databaseServices'),
  getKeyValueObject: jest.fn(),
  getKeyValuePair: jest.fn(),
}));

jest.mock('../../../utils/CommonUtils', () => ({
  errorMsg: jest
    .fn()
    .mockImplementation((value: string) => <span>{value}</span>),
  getCurrentDate: jest.fn(),
  getCurrentUserId: jest.fn(),
  getSeparator: jest.fn(),
  getServiceLogo: jest.fn(),
  requiredField: jest.fn(),
}));

describe('Test AddServiceModal Component', () => {
  it('Component should render', async () => {
    const { container } = render(
      <AddServiceModal
        header="Test"
        serviceList={mockServiceList}
        serviceName="dashboardServices"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );
    const serviceModal = await findByTestId(container, 'service-modal');

    expect(serviceModal).toBeInTheDocument();
    expect(
      await findByText(container, /IngestionStepper component/i)
    ).toBeInTheDocument();
  });

  it('onClick of cancel onCancel should be call', async () => {
    const { container } = render(
      <AddServiceModal
        header="Test"
        serviceList={mockServiceList}
        serviceName="dashboardServices"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );
    const cancel = await findByTestId(container, 'close-modal');
    fireEvent.click(
      cancel,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockOnCancel).toBeCalledTimes(1);
  });

  it('form with all the Field should render for databaseServices', async () => {
    // isIngestionEnable = true;
    const { container } = render(
      <AddServiceModal
        header="Test"
        serviceList={mockServiceList}
        serviceName="databaseServices"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );
    const form = await findByTestId(container, 'form');
    const selectService = await findByTestId(container, 'selectService');
    const nextButton = await findByTestId(container, 'next-button');

    selectService.firstElementChild &&
      fireEvent.click(selectService.firstElementChild);

    expect(form).toBeInTheDocument();
    expect(selectService).toBeInTheDocument();
    expect(selectService.firstElementChild).toHaveClass('tw-border-primary');

    fireEvent.click(nextButton);
    fireEvent.click(nextButton);

    expect(
      await findByText(container, /Service name is required./i)
    ).toBeInTheDocument();

    const name = await findByTestId(container, 'name');
    const description = await findByTestId(container, 'description');

    fireEvent.change(name, {
      target: {
        value: 'serviceName',
      },
    });

    expect(name).toBeInTheDocument();
    expect(name).toHaveValue('serviceName');
    expect(description).toBeInTheDocument();

    fireEvent.click(nextButton);
    fireEvent.click(nextButton);

    expect(
      await findByText(container, /Host name is required/i)
    ).toBeInTheDocument();
    expect(
      await findByText(container, /Port is required/i)
    ).toBeInTheDocument();

    const url = await findByTestId(container, 'url');
    const port = await findByTestId(container, 'port');
    const userName = await findByTestId(container, 'username');
    const password = await findByTestId(container, 'password');
    const database = await findByTestId(container, 'database');
    const connectionOptions = await findByTestId(
      container,
      'connection-options'
    );
    const connectionArguments = await findByTestId(
      container,
      'connection-arguments'
    );

    fireEvent.change(url, {
      target: {
        value: 'localhost',
      },
    });
    fireEvent.change(port, {
      target: {
        value: '3000',
      },
    });

    expect(url).toHaveValue('localhost');
    expect(url).toBeInTheDocument();
    expect(port).toHaveValue('3000');
    expect(port).toBeInTheDocument();
    expect(userName).toBeInTheDocument();
    expect(password).toBeInTheDocument();
    expect(database).toBeInTheDocument();
    expect(connectionOptions).toBeInTheDocument();
    expect(connectionArguments).toBeInTheDocument();

    fireEvent.click(nextButton);

    const ingestionDetailsContainer = await findByTestId(
      container,
      'ingestion-details-container'
    );
    const ingestionName = await findByTestId(container, 'ingestionName');
    const tableIncludeFilterPattern = await findByTestId(
      container,
      'table-include-filter-pattern'
    );
    const tableExcludeFilterPattern = await findByTestId(
      container,
      'table-exclude-filter-pattern'
    );
    const schemaIncludeFilterPattern = await findByTestId(
      container,
      'schema-include-filter-pattern'
    );
    const schemaExcludeFilterPattern = await findByTestId(
      container,
      'schema-exclude-filter-pattern'
    );
    const includeViews = await findByTestId(container, 'include-views');
    const dataProfiler = await findByTestId(container, 'data-profiler');
    const sampleDataIngestion = await findByTestId(
      container,
      'sample-data-ingestion'
    );
    const scheduleInterval = await findByTestId(container, 'schedule-interval');
    const startDate = await findByTestId(container, 'start-date');
    const endDate = await findByTestId(container, 'end-date');

    expect(ingestionDetailsContainer).toBeInTheDocument();
    expect(ingestionName).toHaveValue('serviceName_metadata'); // service name + ingestion type
    expect(
      await findByText(container, /Metadata Extraction/i)
    ).toBeInTheDocument();
    expect(tableIncludeFilterPattern).toBeInTheDocument();
    expect(tableExcludeFilterPattern).toBeInTheDocument();
    expect(schemaIncludeFilterPattern).toBeInTheDocument();
    expect(schemaExcludeFilterPattern).toBeInTheDocument();
    expect(scheduleInterval).toBeInTheDocument();
    expect(startDate).toBeInTheDocument();
    expect(endDate).toBeInTheDocument();
    expect(await findByTestId(container, 'ingestion-switch')).toHaveClass(
      'open'
    );
    expect(includeViews).toHaveClass('open');
    expect(dataProfiler).not.toHaveClass('open');
    expect(sampleDataIngestion).not.toHaveClass('open');

    fireEvent.click(nextButton);

    expect(await findByText(container, /Service Type/)).toBeInTheDocument();
    expect(await findByText(container, /Service Name/)).toBeInTheDocument();
    expect(await findByText(container, /Host/)).toBeInTheDocument();
    expect(await findByText(container, /Port/)).toBeInTheDocument();
    expect(await findByText(container, /Ingestion name/)).toBeInTheDocument();
    expect(await findByText(container, /Include views/)).toBeInTheDocument();
    expect(
      await findByText(container, /Enable data profiler/)
    ).toBeInTheDocument();
    expect(
      await findByText(container, /Ingest sample data/)
    ).toBeInTheDocument();
    expect(
      await findByText(
        container,
        /At 5 minutes past the hour, every hour, every day/i
      )
    ).toBeInTheDocument();

    const deployButton = await findByTestId(container, 'deploy-button');
    fireEvent.click(deployButton);

    expect(mockOnSave).toBeCalled();
  });

  it('form with all the Field should render for dashboardServices', async () => {
    const { container } = render(
      <AddServiceModal
        header="Test"
        serviceList={mockServiceList}
        serviceName="dashboardServices"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );

    const form = await findByTestId(container, 'form');
    const selectService = await findByTestId(container, 'selectService');
    const nextButton = await findByTestId(container, 'next-button');

    selectService.firstElementChild &&
      fireEvent.click(selectService.firstElementChild);

    expect(form).toBeInTheDocument();
    expect(selectService).toBeInTheDocument();
    expect(selectService.firstElementChild).toHaveClass('tw-border-primary');

    fireEvent.click(nextButton);
    fireEvent.click(nextButton);

    expect(
      await findByText(container, /Service name is required./i)
    ).toBeInTheDocument();

    const name = await findByTestId(container, 'name');
    const description = await findByTestId(container, 'description');

    fireEvent.change(name, {
      target: {
        value: 'serviceName',
      },
    });

    expect(name).toBeInTheDocument();
    expect(name).toHaveValue('serviceName');
    expect(description).toBeInTheDocument();

    fireEvent.click(nextButton);
    fireEvent.click(nextButton);

    expect(
      await findByText(container, /Dashboard url is required/i)
    ).toBeInTheDocument();
    expect(
      await findByText(container, /Username is required/i)
    ).toBeInTheDocument();
    expect(
      await findByText(container, /Password is required/i)
    ).toBeInTheDocument();

    const dashboardUrl = await findByTestId(container, 'dashboard-url');
    const username = await findByTestId(container, 'username');
    const password = await findByTestId(container, 'password');

    fireEvent.change(dashboardUrl, {
      target: {
        value: 'dashboardUrl',
      },
    });
    fireEvent.change(username, {
      target: {
        value: 'username',
      },
    });
    fireEvent.change(password, {
      target: {
        value: 'password',
      },
    });

    expect(dashboardUrl).toBeInTheDocument();
    expect(dashboardUrl).toHaveValue('dashboardUrl');
    expect(username).toBeInTheDocument();
    expect(username).toHaveValue('username');
    expect(password).toBeInTheDocument();
    expect(password).toHaveValue('password');

    fireEvent.click(nextButton);

    expect(await findByText(container, /Service Type/)).toBeInTheDocument();
    expect(await findByText(container, /Service Name/)).toBeInTheDocument();
    expect(await findByText(container, /Dashboard Url/)).toBeInTheDocument();
    expect(await findByText(container, /Username/)).toBeInTheDocument();
    expect(await findByText(container, /Password/)).toBeInTheDocument();

    const deployButton = await findByTestId(container, 'deploy-button');
    fireEvent.click(deployButton);

    expect(mockOnSave).toBeCalled();
  });

  it('form with all the Field should render for messagingServices', async () => {
    const { container } = render(
      <AddServiceModal
        header="Test"
        serviceList={mockServiceList}
        serviceName="messagingServices"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );

    const form = await findByTestId(container, 'form');
    const selectService = await findByTestId(container, 'selectService');
    const nextButton = await findByTestId(container, 'next-button');

    selectService.firstElementChild &&
      fireEvent.click(selectService.firstElementChild);

    expect(form).toBeInTheDocument();
    expect(selectService).toBeInTheDocument();
    expect(selectService.firstElementChild).toHaveClass('tw-border-primary');

    fireEvent.click(nextButton);
    fireEvent.click(nextButton);

    expect(
      await findByText(container, /Service name is required./i)
    ).toBeInTheDocument();

    const name = await findByTestId(container, 'name');
    const description = await findByTestId(container, 'description');

    fireEvent.change(name, {
      target: {
        value: 'serviceName',
      },
    });

    expect(name).toBeInTheDocument();
    expect(name).toHaveValue('serviceName');
    expect(description).toBeInTheDocument();

    fireEvent.click(nextButton);
    fireEvent.click(nextButton);

    expect(
      await findByText(container, /Broker url is required/i)
    ).toBeInTheDocument();

    const brokerUrl = await findByTestId(container, 'broker-url');
    const schemaRegistry = await findByTestId(container, 'schema-registry');
    fireEvent.change(brokerUrl, {
      target: {
        value: 'localhost:3000',
      },
    });

    expect(brokerUrl).toBeInTheDocument();
    expect(brokerUrl).toHaveValue('localhost:3000');
    expect(schemaRegistry).toBeInTheDocument();

    fireEvent.click(nextButton);

    expect(await findByText(container, /Service Type/)).toBeInTheDocument();
    expect(await findByText(container, /Service Name/)).toBeInTheDocument();
    expect(await findByText(container, /Broker Url/)).toBeInTheDocument();

    const deployButton = await findByTestId(container, 'deploy-button');
    fireEvent.click(deployButton);

    expect(mockOnSave).toBeCalled();
  });

  it('form with all the Field should render for pipelineServices', async () => {
    const { container } = render(
      <AddServiceModal
        header="Test"
        serviceList={mockServiceList}
        serviceName="pipelineServices"
        onCancel={mockOnCancel}
        onSave={mockOnSave}
      />
    );

    const form = await findByTestId(container, 'form');
    const selectService = await findByTestId(container, 'selectService');
    const nextButton = await findByTestId(container, 'next-button');

    selectService.firstElementChild &&
      fireEvent.click(selectService.firstElementChild);

    expect(form).toBeInTheDocument();
    expect(selectService).toBeInTheDocument();
    expect(selectService.firstElementChild).toHaveClass('tw-border-primary');

    fireEvent.click(nextButton);
    fireEvent.click(nextButton);

    expect(
      await findByText(container, /Service name is required./i)
    ).toBeInTheDocument();

    const name = await findByTestId(container, 'name');
    const description = await findByTestId(container, 'description');

    fireEvent.change(name, {
      target: {
        value: 'serviceName',
      },
    });

    expect(name).toBeInTheDocument();
    expect(name).toHaveValue('serviceName');
    expect(description).toBeInTheDocument();

    fireEvent.click(nextButton);
    fireEvent.click(nextButton);

    expect(await findByText(container, /Url is required/i)).toBeInTheDocument();

    const pipelineUrl = await findByTestId(container, 'pipeline-url');
    fireEvent.change(pipelineUrl, {
      target: {
        value: 'localhost:3000',
      },
    });

    expect(pipelineUrl).toBeInTheDocument();
    expect(pipelineUrl).toHaveValue('localhost:3000');

    fireEvent.click(nextButton);

    expect(await findByText(container, /Service Type/)).toBeInTheDocument();
    expect(await findByText(container, /Service Name/)).toBeInTheDocument();
    expect(await findByText(container, /Pipeline Url/)).toBeInTheDocument();

    const deployButton = await findByTestId(container, 'deploy-button');
    fireEvent.click(deployButton);

    expect(mockOnSave).toBeCalled();
  });
});
