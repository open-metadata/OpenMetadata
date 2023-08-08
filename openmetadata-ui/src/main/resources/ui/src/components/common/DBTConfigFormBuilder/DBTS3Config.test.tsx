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
import { dbtParsingTimeoutLimit } from './DBTFormConstants';
import { DBTS3Config } from './DBTS3Config';

const mockProps = {
  enableDebugLog: false,
  parsingTimeoutLimit: dbtParsingTimeoutLimit,
};

jest.mock('./DBTCommonFields.component', () =>
  jest.fn().mockImplementation(() => <div>DBT Common Fields</div>)
);

describe('Test DBT S3 Config Form', () => {
  it('Fields should render', async () => {
    render(<DBTS3Config {...mockProps} />);
    const inputAccessKeyId = screen.getByTestId('aws-access-key-id');
    const inputSecretKey = screen.getByTestId('aws-secret-access-key-id');
    const inputRegion = screen.getByTestId('awsRegion');
    const inputSessionToken = screen.getByTestId('aws-session-token');
    const inputEndpointUrl = screen.getByTestId('endpoint-url');
    const inputBucketName = screen.getByTestId('dbt-bucket-name');
    const inputObjPrefix = screen.getByTestId('dbt-object-prefix');

    expect(inputAccessKeyId).toBeInTheDocument();
    expect(inputSecretKey).toBeInTheDocument();
    expect(inputRegion).toBeInTheDocument();
    expect(inputSessionToken).toBeInTheDocument();
    expect(inputEndpointUrl).toBeInTheDocument();
    expect(inputBucketName).toBeInTheDocument();
    expect(inputObjPrefix).toBeInTheDocument();
  });
});
