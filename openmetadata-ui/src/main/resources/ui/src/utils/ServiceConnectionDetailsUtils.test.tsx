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

import { render, screen } from '@testing-library/react';
import { ServiceCategory } from '../enums/service.enum';
import { getKeyValues } from './ServiceConnectionDetailsUtils';

const serviceAccountSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'service_account' },
    projectId: { type: 'string', title: 'Project ID' },
    privateKey: {
      type: 'string',
      title: 'Private Key',
      format: 'password',
    },
  },
};

const externalAccountSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'external_account' },
    audience: { type: 'string', title: 'Audience' },
  },
};

const credentialPathSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'gcp_credential_path' },
    path: { type: 'string', title: 'Path' },
    projectId: { type: 'string', title: 'Project ID' },
  },
};

const adcSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', const: 'gcp_adc' },
    projectId: { type: 'string', title: 'Project ID' },
  },
};

const schema = {
  properties: {
    gcpConfig: {
      definitions: {
        gcpCredentialsPath: credentialPathSchema,
        gcpADC: adcSchema,
      },
      properties: {
        gcpConfig: {
          oneOf: [
            serviceAccountSchema,
            { $ref: '#/definitions/gcpCredentialsPath' },
            externalAccountSchema,
            { $ref: '#/definitions/gcpADC' },
          ],
        },
      },
    },
    topicFilterPattern: {
      type: 'object',
      properties: {
        includes: { type: 'array', items: { type: 'string' } },
        excludes: { type: 'array', items: { type: 'string' } },
      },
    },
  },
};

const renderConnection = (credentials: Record<string, unknown>) => {
  render(
    <>
      {getKeyValues({
        obj: { gcpConfig: { gcpConfig: credentials } },
        schemaPropertyObject: schema.properties,
        schema,
        serviceCategory: ServiceCategory.MESSAGING_SERVICES,
      })}
    </>
  );
};

describe('getKeyValues', () => {
  it('selects service account branch and masks private key once', () => {
    renderConnection({
      type: 'service_account',
      projectId: 'sample-project',
      privateKey: 'private-key',
    });

    expect(screen.getAllByDisplayValue('private-key')).toHaveLength(1);
    expect(screen.getByDisplayValue('private-key')).toHaveAttribute(
      'type',
      'password'
    );
    expect(screen.getAllByText('privateKey:')).toHaveLength(1);
    expect(screen.queryByText('path:')).not.toBeInTheDocument();
    expect(screen.queryByText('audience:')).not.toBeInTheDocument();
  });

  it('does not render union fields when credential type is unknown', () => {
    renderConnection({
      type: 'unknown',
      privateKey: 'private-key',
    });

    expect(screen.queryByDisplayValue('private-key')).not.toBeInTheDocument();
    expect(screen.queryByText('privateKey:')).not.toBeInTheDocument();
  });

  it.each([
    [
      'credential path',
      { type: 'gcp_credential_path', path: '/tmp/credentials.json' },
      'path:',
      '/tmp/credentials.json',
    ],
    [
      'ADC',
      { type: 'gcp_adc', projectId: 'sample-project' },
      'projectId:',
      'sample-project',
    ],
  ])('selects and resolves %s branch', (_, credentials, label, value) => {
    renderConnection(credentials);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByDisplayValue(value)).toBeInTheDocument();
    expect(screen.queryByText('privateKey:')).not.toBeInTheDocument();
    expect(screen.queryByText('audience:')).not.toBeInTheDocument();
  });

  it('renders a filter pattern when only includes is present', () => {
    render(
      <>
        {getKeyValues({
          obj: { topicFilterPattern: { includes: ['topic_.*'] } },
          schemaPropertyObject: schema.properties,
          schema,
          serviceCategory: ServiceCategory.MESSAGING_SERVICES,
        })}
      </>
    );

    expect(screen.getByText('Includes:')).toBeInTheDocument();
    expect(screen.getByText('topic_.*')).toBeInTheDocument();
  });
});
