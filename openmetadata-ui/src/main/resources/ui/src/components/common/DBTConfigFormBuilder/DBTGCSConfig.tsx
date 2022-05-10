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

import { isEmpty, isObject, isString } from 'lodash';
import React, {
  Fragment,
  FunctionComponent,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  DBTBucketDetails,
  DbtConfigSource,
  GCSCredentialsValues,
  SCredentials,
} from '../../../generated/metadataIngestion/databaseServiceMetadataPipeline';
import jsonData from '../../../jsons/en';
import {
  errorMsg,
  getSeparator,
  requiredField,
} from '../../../utils/CommonUtils';
import {
  checkDbtGCSCredsConfigRules,
  validateDbtGCSCredsConfig,
} from '../../../utils/DBTConfigFormUtil';
import { Button } from '../../buttons/Button/Button';
import { Field } from '../../Field/Field';
import {
  DbtConfigS3GCS,
  DBTFormCommonProps,
  ErrorDbtGCS,
} from './DBTConfigForm.interface';
import { GCSCreds } from './DBTFormConstants';
import { GCS_CONFIG } from './DBTFormEnum';

interface Props extends DBTFormCommonProps, DbtConfigS3GCS {
  gcsType?: GCS_CONFIG;
  handleGcsTypeChange?: (type: GCS_CONFIG) => void;
  handleSecurityConfigChange: (value?: SCredentials) => void;
  handlePrefixConfigChange: (value: DBTBucketDetails) => void;
}

export const DBTGCSConfig: FunctionComponent<Props> = ({
  dbtSecurityConfig,
  dbtPrefixConfig,
  gcsType = GCS_CONFIG.GCSValues,
  okText,
  cancelText,
  onCancel,
  onSubmit,
  handleGcsTypeChange,
  handleSecurityConfigChange,
  handlePrefixConfigChange,
}: Props) => {
  const isMounted = useRef<boolean>(false);
  const updateGCSCredsConfig = (
    key: keyof GCSCredentialsValues,
    val: string
  ) => {
    const gcsConfig = isObject(dbtSecurityConfig?.gcsConfig)
      ? dbtSecurityConfig?.gcsConfig
      : {};
    const updatedCreds: SCredentials = {
      gcsConfig: {
        ...(gcsConfig as GCSCredentialsValues),
        [key]: val,
      },
    };
    handleSecurityConfigChange(updatedCreds);
  };

  const updateDbtBucket = (key: keyof DBTBucketDetails, val: string) => {
    const updatedBucket: DBTBucketDetails = {
      ...dbtPrefixConfig,
      [key]: val,
    };
    handlePrefixConfigChange(updatedBucket);
  };

  const updateGCSCredsPath = (val: string) => {
    const updatedCreds: SCredentials = {
      gcsConfig: val,
    };
    handleSecurityConfigChange(updatedCreds);
  };

  const [errors, setErrors] = useState<ErrorDbtGCS>();
  const validate = (data: DbtConfigSource) => {
    let valid = true;
    const gcsConfig = data.dbtSecurityConfig?.gcsConfig;
    if (gcsType === GCS_CONFIG.GCSValues) {
      const { isValid: reqValid, errors: reqErr } = validateDbtGCSCredsConfig(
        (gcsConfig || {}) as GCSCredentialsValues
      );
      const { isValid: fieldValid, errors: fieldErr } =
        checkDbtGCSCredsConfigRules((gcsConfig || {}) as GCSCredentialsValues);

      setErrors({
        ...fieldErr,
        ...reqErr,
      });

      valid = reqValid && fieldValid;
    } else {
      if (isEmpty(gcsConfig)) {
        setErrors({
          gcsConfig: `GCS Config ${jsonData['form-error-messages']['is-required']}`,
        } as ErrorDbtGCS);
        valid = false;
      } else {
        setErrors({} as ErrorDbtGCS);
      }
    }

    return valid;
  };

  const handleSubmit = () => {
    const submitData = { dbtSecurityConfig, dbtPrefixConfig };
    if (validate(submitData)) {
      onSubmit(submitData);
    }
  };

  const gcsCredConfigs = (gcsConfig?: GCSCredentialsValues) => {
    return (
      <Fragment>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="credential-type">
            {requiredField('Credentials Type')}
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
          {errors?.type && errorMsg(errors.type)}
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="project-id">
            {requiredField('Project ID')}
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
          {errors?.projectId && errorMsg(errors.projectId)}
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="private-key-id">
            {requiredField('Private Key ID')}
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
          {errors?.privateKeyId && errorMsg(errors.privateKeyId)}
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="private-key">
            {requiredField('Private Key')}
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
          {errors?.privateKey && errorMsg(errors.privateKey)}
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="client-email">
            {requiredField('Client Email')}
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
          {errors?.clientEmail && errorMsg(errors.clientEmail)}
        </Field>
        <Field>
          <label className="tw-block tw-form-label tw-mb-1" htmlFor="client-id">
            {requiredField('Client ID')}
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
          {errors?.clientId && errorMsg(errors.clientId)}
        </Field>
        <Field>
          <label className="tw-block tw-form-label tw-mb-1" htmlFor="auth-uri">
            {requiredField('Authentication URI')}
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
          {errors?.authUri && errorMsg(errors.authUri)}
        </Field>
        <Field>
          <label className="tw-block tw-form-label tw-mb-1" htmlFor="token-uri">
            {requiredField('Token URI')}
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
          {errors?.tokenUri && errorMsg(errors.tokenUri)}
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="auth-x509-certificate-uri">
            {requiredField('Authentication Provider x509 Certificate URL')}
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
          {errors?.authProviderX509CertUrl &&
            errorMsg(errors.authProviderX509CertUrl)}
        </Field>
        <Field>
          <label
            className="tw-block tw-form-label tw-mb-1"
            htmlFor="client-x509-certificate-uri">
            {requiredField('Client x509 Certificate URL')}
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
          {errors?.clientX509CertUrl && errorMsg(errors.clientX509CertUrl)}
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
          {requiredField('GCS Credentials Path')}
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
          value={isString(gcsConfig) ? gcsConfig : ''}
          onChange={(e) => updateGCSCredsPath(e.target.value)}
        />
        {errors?.gcsConfig && errorMsg(errors.gcsConfig)}
      </Field>
    );
  };

  useEffect(() => {
    if (isMounted.current) {
      handleSecurityConfigChange();
    }
  }, [gcsType]);

  useEffect(() => {
    isMounted.current = true;
  }, []);

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
          value={gcsType}
          onChange={(e) => {
            handleGcsTypeChange &&
              handleGcsTypeChange(e.target.value as GCS_CONFIG);
          }}>
          {GCSCreds.map((option, i) => (
            <option key={i} value={option.value}>
              {option.name}
            </option>
          ))}
        </select>
      </Field>
      {gcsType === GCS_CONFIG.GCSValues
        ? gcsCredConfigs(dbtSecurityConfig?.gcsConfig as GCSCredentialsValues)
        : gcsCredPath(dbtSecurityConfig?.gcsConfig as string)}
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="dbt-bucket-name">
          DBT Bucket Name
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          Name of the bucket where the dbt files are stored.
        </p>
        <input
          className="tw-form-inputs tw-px-3 tw-py-1"
          data-testid="dbt-bucket-name"
          id="dbt-bucket-name"
          name="dbt-bucket-name"
          type="text"
          value={dbtPrefixConfig?.dbtBucketName}
          onChange={(e) => updateDbtBucket('dbtBucketName', e.target.value)}
        />
      </Field>
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="dbt-object-prefix">
          DBT Object Prefix
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          Path of the folder where the dbt files are stored.
        </p>
        <input
          className="tw-form-inputs tw-px-3 tw-py-1"
          data-testid="dbt-object-prefix"
          id="dbt-object-prefix"
          name="dbt-object-prefix"
          type="text"
          value={dbtPrefixConfig?.dbtObjectPrefix}
          onChange={(e) => updateDbtBucket('dbtObjectPrefix', e.target.value)}
        />
      </Field>
      {getSeparator('')}

      <Field className="tw-flex tw-justify-end">
        <Button
          className="tw-mr-2"
          data-testid="back-button"
          size="regular"
          theme="primary"
          variant="text"
          onClick={onCancel}>
          <span>{cancelText}</span>
        </Button>

        <Button
          data-testid="submit-btn"
          size="regular"
          theme="primary"
          variant="contained"
          onClick={handleSubmit}>
          <span>{okText}</span>
        </Button>
      </Field>
    </Fragment>
  );
};
