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

import React, { Fragment, FunctionComponent, useState } from 'react';
import {
  DbtConfigSource,
  GCSCredentialsValues,
  SCredentials,
} from '../../../generated/metadataIngestion/databaseServiceMetadataPipeline';
import { DropDownListItem } from '../../dropdown/types';
import { Field } from '../../Field/Field';

interface Props extends Pick<DbtConfigSource, 'dbtSecurityConfig'> {
  handleSecurityConfigChange: (value: SCredentials) => void;
}

enum GCS_CONFIG {
  GCSValues = 'GCSValues',
  GCSCredentialsPath = 'GCSCredentialsPath',
}

const GCSCreds: Array<DropDownListItem> = [
  {
    name: 'GCS Credentials Values',
    value: GCS_CONFIG.GCSValues,
  },
  {
    name: 'GCS Credentials Path',
    value: GCS_CONFIG.GCSCredentialsPath,
  },
];

export const DBTGCSConfig: FunctionComponent<Props> = ({
  dbtSecurityConfig,
  handleSecurityConfigChange,
}: Props) => {
  const [gcsCreds, setGcsCreds] = useState<GCS_CONFIG>(GCS_CONFIG.GCSValues);

  const updateGCSCredsConfig = (
    key: keyof GCSCredentialsValues,
    val: string
  ) => {
    const { gcsConfig } = dbtSecurityConfig as SCredentials;
    const updatedCreds: SCredentials = {
      ...dbtSecurityConfig,
      gcsConfig: {
        ...(gcsConfig as GCSCredentialsValues),
        [key]: val,
      },
    };
    handleSecurityConfigChange(updatedCreds);
  };

  const updateGCSCredsPath = (val: string) => {
    const updatedCreds: SCredentials = {
      ...dbtSecurityConfig,
      gcsConfig: val,
    };
    handleSecurityConfigChange(updatedCreds);
  };

  const gcsCredConfigs = (gcsConfig?: GCSCredentialsValues) => {
    return (
      <Fragment>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="credential-type">
            Credentials Type
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            Google Cloud service account type.
          </p>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="credential-type"
            id="credential-type"
            name="credential-type"
            type="text"
            value={gcsConfig?.type}
            onChange={(e) => updateGCSCredsConfig('type', e.target.value)}
          />
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="project-id">
            Project ID
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            Google Cloud project id.
          </p>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="project-id"
            id="project-id"
            name="project-id"
            type="text"
            value={gcsConfig?.projectId}
            onChange={(e) => updateGCSCredsConfig('projectId', e.target.value)}
          />
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="private-key-id">
            Private Key ID
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            Google Cloud Private key id.
          </p>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="private-key-id"
            id="private-key-id"
            name="private-key-id"
            type="text"
            value={gcsConfig?.privateKeyId}
            onChange={(e) =>
              updateGCSCredsConfig('privateKeyId', e.target.value)
            }
          />
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="private-key">
            Private Key
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            Google Cloud private key.
          </p>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="private-key"
            id="private-key"
            name="private-key"
            type="text"
            value={gcsConfig?.privateKey}
            onChange={(e) => updateGCSCredsConfig('privateKey', e.target.value)}
          />
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="client-email">
            Client Email
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            Google Cloud email.
          </p>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="client-email"
            id="client-email"
            name="client-email"
            type="text"
            value={gcsConfig?.clientEmail}
            onChange={(e) =>
              updateGCSCredsConfig('clientEmail', e.target.value)
            }
          />
        </Field>
        <Field>
          <label className="tw-block tw-form-label tw-mb-1" htmlFor="client-id">
            Client ID
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            Google Cloud Client ID.
          </p>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="client-id"
            id="client-id"
            name="client-id"
            type="text"
            value={gcsConfig?.clientId}
            onChange={(e) => updateGCSCredsConfig('clientId', e.target.value)}
          />
        </Field>
        <Field>
          <label className="tw-block tw-form-label tw-mb-1" htmlFor="auth-uri">
            Authentication URI
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            Google Cloud auth uri.
          </p>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="auth-uri"
            id="auth-uri"
            name="auth-uri"
            type="text"
            value={gcsConfig?.authUri}
            onChange={(e) => updateGCSCredsConfig('authUri', e.target.value)}
          />
        </Field>
        <Field>
          <label className="tw-block tw-form-label tw-mb-1" htmlFor="token-uri">
            Token URI
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            Google Cloud token uri.
          </p>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="token-uri"
            id="token-uri"
            name="token-uri"
            type="text"
            value={gcsConfig?.tokenUri}
            onChange={(e) => updateGCSCredsConfig('tokenUri', e.target.value)}
          />
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="auth-x509-certificate-uri">
            Authentication Provider x509 Certificate URL
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            Google Cloud auth provider certificate.
          </p>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="auth-x509-certificate-uri"
            id="auth-x509-certificate-uri"
            name="auth-x509-certificate-uri"
            type="text"
            value={gcsConfig?.authProviderX509CertUrl}
            onChange={(e) =>
              updateGCSCredsConfig('authProviderX509CertUrl', e.target.value)
            }
          />
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="client-x509-certificate-uri">
            Client x509 Certificate URL
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            Google Cloud client certificate uri.
          </p>
          <input
            className="tw-form-inputs tw-px-3 tw-py-1"
            data-testid="client-x509-certificate-uri"
            id="client-x509-certificate-uri"
            name="client-x509-certificate-uri"
            type="text"
            value={gcsConfig?.clientX509CertUrl}
            onChange={(e) =>
              updateGCSCredsConfig('clientX509CertUrl', e.target.value)
            }
          />
        </Field>
      </Fragment>
    );
  };

  const gcsCredPath = (gcsConfig: string) => {
    return (
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="gcs-cred-path">
          GCS Credentials Path
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          GCS Credentials Path.
        </p>
        <input
          className="tw-form-inputs tw-px-3 tw-py-1"
          data-testid="gcs-cred-path"
          id="gcs-cred-path"
          name="gcs-cred-path"
          type="text"
          value={gcsConfig}
          onChange={(e) => updateGCSCredsPath(e.target.value)}
        />
      </Field>
    );
  };

  return (
    <Fragment>
      <Field>
        <label className="tw-block tw-form-label tw-mb-1" htmlFor="gcs-config">
          DBT Configuration Source
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
          Available sources to fetch DBT catalog and manifest files.
        </p>
        <select
          className="tw-form-inputs tw-px-3 tw-py-1"
          data-testid="gcs-config"
          id="gcs-config"
          name="gcs-config"
          placeholder="Select GCS Config Type"
          value={gcsCreds}
          onChange={(e) => setGcsCreds(e.target.value as GCS_CONFIG)}>
          {GCSCreds.map((option, i) => (
            <option key={i} value={option.value}>
              {option.name}
            </option>
          ))}
        </select>
      </Field>
      {gcsCreds === GCS_CONFIG.GCSValues
        ? gcsCredConfigs(dbtSecurityConfig?.gcsConfig as GCSCredentialsValues)
        : gcsCredPath(dbtSecurityConfig?.gcsConfig as string)}
    </Fragment>
  );
};
