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

import { render, screen } from '@testing-library/react';
import { AddIngestionState } from 'components/AddIngestion/addIngestion.interface';
import { FormSubmitType } from 'enums/form.enum';
import React from 'react';
import DBTConfigFormBuilder from './DBTConfigFormBuilder';

const handleSubmit = jest.fn();
const handleFocus = jest.fn();
const handleCancel = jest.fn();
const handleChange = jest.fn();

describe('DBTConfigFormBuilder', () => {
  it('renders the DBTCloudConfig form when dbtConfigSourceType is "cloud"', async () => {
    const data = {
      dbtConfigSourceType: 'cloud',
    };
    render(
      <DBTConfigFormBuilder
        cancelText="Cancel"
        data={data as AddIngestionState}
        formType={FormSubmitType.ADD}
        okText="Ok"
        onCancel={handleCancel}
        onChange={handleChange}
        onFocus={handleFocus}
        onSubmit={handleSubmit}
      />
    );

    const classificationNameField = screen.getByTestId(
      'dbt-classification-name'
    );
    const dbtCloudAccountId = screen.getByTestId('cloud-account-id');
    const dbtCloudAuthToken = screen.getByTestId('cloud-auth-token');
    const cloudUrlField = screen.getByTestId('dbtCloudUrl');
    const jobIdField = screen.getByTestId('dbtCloudJobId');
    const projectIdField = screen.getByTestId('dbtCloudProjectId');
    const okButton = screen.getByTestId('submit-btn');
    const cancelButton = screen.getByTestId('back-button');

    expect(classificationNameField).toBeInTheDocument();
    expect(cloudUrlField).toBeInTheDocument();
    expect(jobIdField).toBeInTheDocument();
    expect(projectIdField).toBeInTheDocument();
    expect(okButton).toBeInTheDocument();
    expect(cancelButton).toBeInTheDocument();
    expect(dbtCloudAccountId).toBeInTheDocument();
    expect(dbtCloudAuthToken).toBeInTheDocument();
  });
});
