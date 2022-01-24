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
import { MemoryRouter } from 'react-router';
import IngestionModal from './IngestionModal.component';

const mockFunction = jest.fn();
const mockServiceList = [
  {
    name: 'aws_redshift',
    serviceType: 'Redshift',
  },
];

jest.mock('../IngestionStepper/IngestionStepper.component', () => {
  return jest.fn().mockReturnValue(<p>IngestionStepper</p>);
});

describe('Test Ingestion modal component', () => {
  it('Component Should render', async () => {
    const { container } = render(
      <IngestionModal
        header="Add Ingestion"
        ingestionList={[]}
        ingestionTypes={[]}
        serviceList={mockServiceList}
        onCancel={mockFunction}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    const ingestionModalContainer = await findByTestId(
      container,
      'ingestion-modal-container'
    );
    const ingestionModalTitle = await findByTestId(container, 'modal-title');
    const closeSvgButton = await findByTestId(container, 'close-modal');
    const modalBody = await findByTestId(container, 'modal-body');
    const modalFooter = await findByTestId(container, 'modal-footer');
    const nextButton = await findByTestId(container, 'next-button');
    const previousButton = await findByTestId(container, 'previous-button');

    expect(ingestionModalContainer).toBeInTheDocument();
    expect(ingestionModalTitle).toBeInTheDocument();
    expect(closeSvgButton).toBeInTheDocument();
    expect(modalBody).toBeInTheDocument();
    expect(modalFooter).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();
    expect(previousButton).toHaveClass('tw-invisible');
    expect(
      await findByText(container, /IngestionStepper/i)
    ).toBeInTheDocument();
  });

  it('Ingestion journey', async () => {
    const { container } = render(
      <IngestionModal
        addIngestion={mockFunction}
        header="Add Ingestion"
        ingestionList={[]}
        ingestionTypes={[]}
        serviceList={mockServiceList}
        onCancel={mockFunction}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    // Step 1
    const nextButton = await findByTestId(container, 'next-button');
    const previousButton = await findByTestId(container, 'previous-button');

    fireEvent.click(nextButton);

    expect(
      await findByText(container, /Ingestion Name is required/i)
    ).toBeInTheDocument();

    const name = await findByTestId(container, 'name');
    fireEvent.change(name, {
      target: { value: 'mockName' },
    });

    expect(name).toBeInTheDocument();
    expect(name).toHaveValue('mockName');

    const service = await findByTestId(container, 'select-service');
    fireEvent.change(service, {
      target: { value: 'Redshift$$aws_redshift' },
    });

    expect(service).toBeInTheDocument();
    expect(service).toHaveValue('Redshift$$aws_redshift');

    const ingestionType = await findByTestId(container, 'ingestion-type');
    fireEvent.change(ingestionType, {
      target: { value: 'redshift' },
    });

    expect(ingestionType).toBeInTheDocument();
    expect(ingestionType).toHaveValue('redshift');

    fireEvent.click(nextButton);

    // Step 2
    fireEvent.click(nextButton);

    expect(
      await findByText(container, /Username is required/i)
    ).toBeInTheDocument();
    expect(
      await findByText(container, /Password is required/i)
    ).toBeInTheDocument();
    expect(
      await findByText(container, /Host is required/i)
    ).toBeInTheDocument();
    expect(
      await findByText(container, /Database is required/i)
    ).toBeInTheDocument();
    expect(previousButton).not.toHaveClass('tw-invisible');

    const userName = await findByTestId(container, 'user-name');
    fireEvent.change(userName, {
      target: { value: 'test' },
    });

    expect(userName).toBeInTheDocument();
    expect(userName).toHaveValue('test');

    const password = await findByTestId(container, 'password');
    fireEvent.change(password, {
      target: { value: 'password' },
    });

    expect(password).toBeInTheDocument();
    expect(password).toHaveValue('password');

    const host = await findByTestId(container, 'host');
    fireEvent.change(host, {
      target: { value: 'host' },
    });

    expect(host).toBeInTheDocument();
    expect(host).toHaveValue('host');

    const database = await findByTestId(container, 'database');
    fireEvent.change(database, {
      target: { value: 'database' },
    });

    expect(database).toBeInTheDocument();
    expect(database).toHaveValue('database');

    const includeFilterPattern = await findByTestId(
      container,
      'include-filter-pattern'
    );
    fireEvent.change(includeFilterPattern, {
      target: { value: 'include_pattern' },
    });

    expect(includeFilterPattern).toBeInTheDocument();
    expect(includeFilterPattern).toHaveValue('include_pattern');

    const excludeFilterPattern = await findByTestId(
      container,
      'exclude-filter-pattern'
    );
    fireEvent.change(excludeFilterPattern, {
      target: { value: 'exclude_pattern' },
    });

    expect(excludeFilterPattern).toBeInTheDocument();
    expect(excludeFilterPattern).toHaveValue('exclude_pattern');

    const includeViews = await findByTestId(container, 'include-views');
    fireEvent.click(includeViews);

    expect(includeViews).toBeInTheDocument();
    expect(includeViews).not.toHaveClass('open');

    const dataProfiler = await findByTestId(container, 'data-profiler');
    fireEvent.click(dataProfiler);

    expect(dataProfiler).toBeInTheDocument();
    expect(dataProfiler).toHaveClass('open');

    fireEvent.click(nextButton);

    // Step 3
    const scheduleInterval = await findByTestId(container, 'schedule-interval');

    expect(scheduleInterval).toBeInTheDocument();

    const startDate = await findByTestId(container, 'start-date');
    const endDate = await findByTestId(container, 'end-date');

    expect(startDate).toBeInTheDocument();
    expect(endDate).toBeInTheDocument();

    fireEvent.click(nextButton);

    // Steps 4
    const preview = await findByTestId(container, 'preview-section');
    const deployButton = await findByTestId(container, 'deploy-button');

    expect(preview).toBeInTheDocument();
    expect(deployButton).toBeInTheDocument();

    fireEvent.click(deployButton);

    expect(mockFunction).toBeCalled();
  });
});
