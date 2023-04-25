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
import { DBTCloudConfig } from './DBTCloudConfig';

const mockProps = {
  dbtCloudAccountId: '',
  dbtCloudAuthToken: '',
  dbtUpdateDescriptions: false,
  dbtCloudUrl: 'https://cloud.getdbt.com/',
  enableDebugLog: false,
};

jest.mock('./DBTCommonFields.component', () =>
  jest.fn().mockImplementation(() => <div>DBT Common Fields</div>)
);

describe('Test DBT Cloud Config Form', () => {
  it('Fields should render', async () => {
    render(<DBTCloudConfig {...mockProps} />);
    const dbtCloudAccountId = screen.getByTestId('cloud-account-id');
    const dbtCloudAuthToken = screen.getByTestId('cloud-auth-token');
    const dbtCloudProjectId = screen.getByTestId('dbtCloudProjectId');
    const dbtCloudJobId = screen.getByTestId('dbtCloudJobId');
    const dbtCloudUrl = screen.getByTestId('dbtCloudUrl');

    expect(dbtCloudAccountId).toBeInTheDocument();
    expect(dbtCloudAuthToken).toBeInTheDocument();
    expect(dbtCloudProjectId).toBeInTheDocument();
    expect(dbtCloudJobId).toBeInTheDocument();
    expect(dbtCloudUrl).toBeInTheDocument();
  });
});
