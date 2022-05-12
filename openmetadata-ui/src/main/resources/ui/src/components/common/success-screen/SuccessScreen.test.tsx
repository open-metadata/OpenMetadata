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

import { findByTestId, queryByTestId, render } from '@testing-library/react';
import React from 'react';
import { FormSubmitType } from '../../../enums/form.enum';
import SuccessScreen from './SuccessScreen';

describe('Test SuccessScreen component', () => {
  it('SuccessScreen component should render', async () => {
    const { container } = render(
      <SuccessScreen
        isAirflowSetup
        showIngestionButton
        handleViewServiceClick={jest.fn()}
        name="NewService"
        state={FormSubmitType.ADD}
        successMessage={<span>title</span>}
      />
    );

    const succsessScreenContainer = await findByTestId(
      container,
      'success-screen-container'
    );
    const successIcon = await findByTestId(container, 'success-icon');
    const successLine = await findByTestId(container, 'success-line');
    const viewServiceBtn = await findByTestId(container, 'view-service-button');
    const addIngestionBtn = await findByTestId(
      container,
      'add-ingestion-button'
    );
    const statusMsg = queryByTestId(container, 'airflow-status-msg');
    const airflowDoc = queryByTestId(container, 'airflow-doc-link');
    const statusCheck = queryByTestId(container, 'airflow-status-check');

    expect(succsessScreenContainer).toBeInTheDocument();
    expect(successIcon).toBeInTheDocument();
    expect(successLine).toBeInTheDocument();
    expect(viewServiceBtn).toBeInTheDocument();
    expect(addIngestionBtn).toBeInTheDocument();
    expect(statusMsg).not.toBeInTheDocument();
    expect(airflowDoc).not.toBeInTheDocument();
    expect(statusCheck).not.toBeInTheDocument();
  });

  it('SuccessScreen component should render with airflow helper text', async () => {
    const { container } = render(
      <SuccessScreen
        showIngestionButton
        handleViewServiceClick={jest.fn()}
        isAirflowSetup={false}
        name="NewService"
        state={FormSubmitType.ADD}
        successMessage={<span>title</span>}
        onCheckAirflowStatus={jest.fn()}
      />
    );

    const succsessScreenContainer = await findByTestId(
      container,
      'success-screen-container'
    );
    const successIcon = await findByTestId(container, 'success-icon');
    const successLine = await findByTestId(container, 'success-line');
    const viewServiceBtn = await findByTestId(container, 'view-service-button');
    const addIngestionBtn = await findByTestId(
      container,
      'add-ingestion-button'
    );
    const statusMsg = await findByTestId(container, 'airflow-status-msg');
    const airflowDoc = await findByTestId(container, 'airflow-doc-link');
    const statusCheck = await findByTestId(container, 'airflow-status-check');

    expect(succsessScreenContainer).toBeInTheDocument();
    expect(successIcon).toBeInTheDocument();
    expect(successLine).toBeInTheDocument();
    expect(viewServiceBtn).toBeInTheDocument();
    expect(addIngestionBtn).toBeInTheDocument();
    expect(statusMsg).toBeInTheDocument();
    expect(airflowDoc).toBeInTheDocument();
    expect(statusCheck).toBeInTheDocument();
  });
});
