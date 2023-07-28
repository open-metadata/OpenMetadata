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
import React from 'react';
import { DBTAzureConfig } from './DBTAzureConfig.component';

const mockProps = {
  enableDebugLog: false,
  parsingTimeoutLimit: 0,
};

jest.mock('./DBTCommonFields.component', () =>
  jest.fn().mockImplementation(() => <div>DBT Common Fields</div>)
);

describe('Test DBT S3 Config Form', () => {
  it('Fields should render', async () => {
    render(<DBTAzureConfig {...mockProps} />);
    const clientID = screen.getByTestId('azure-client-id');
    const clientSecretKey = screen.getByTestId('azure-client-secret');
    const azureTenantId = screen.getByTestId('azure-tenant-id');
    const azureAccountName = screen.getByTestId('azure-account-name');

    expect(clientID).toBeInTheDocument();
    expect(clientSecretKey).toBeInTheDocument();
    expect(azureTenantId).toBeInTheDocument();
    expect(azureAccountName).toBeInTheDocument();
  });
});
