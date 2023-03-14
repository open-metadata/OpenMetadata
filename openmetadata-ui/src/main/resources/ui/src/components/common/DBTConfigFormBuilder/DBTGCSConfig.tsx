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

import { Button, Input, Select } from 'antd';
import { t } from 'i18next';
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
  DbtConfig,
  GCSCredentialsValues,
  SCredentials,
} from '../../../generated/metadataIngestion/dbtPipeline';
import jsonData from '../../../jsons/en';
import { errorMsg, getSeparator } from '../../../utils/CommonUtils';
import { Field } from '../../Field/Field';
import DBTCommonFields from './DBTCommonFields.component';
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
  handleUpdateDescriptions: (value: boolean) => void;
  handleUpdateDBTClassification: (value: string) => void;
  enableDebugLog: boolean;
  handleEnableDebugLogCheck: (value: boolean) => void;
}

export const DBTGCSConfig: FunctionComponent<Props> = ({
  dbtSecurityConfig,
  dbtPrefixConfig,
  dbtUpdateDescriptions = false,
  gcsType = GCS_CONFIG.GCSValues,
  okText,
  cancelText,
  onCancel,
  onSubmit,
  handleGcsTypeChange,
  handleSecurityConfigChange,
  handlePrefixConfigChange,
  handleUpdateDescriptions,
  dbtClassificationName,
  handleUpdateDBTClassification,
  enableDebugLog,
  handleEnableDebugLogCheck,
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
  const validate = (data: DbtConfig) => {
    let valid = true;
    const gcsConfig = data.dbtSecurityConfig?.gcsConfig;
    if (gcsType !== GCS_CONFIG.GCSValues) {
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
    const submitData = {
      dbtSecurityConfig,
      dbtPrefixConfig,
      dbtUpdateDescriptions,
      dbtClassificationName,
    };
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
            {t('label.credentials-type')}
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            {t('label.google-account-service-type')}
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
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
            {t('label.project-id')}
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            {t('label.google-cloud-project-id')}
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
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
            {t('label.private-key-id')}
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            {t('label.google-cloud-private-key-id')}
          </p>
          <Input.Password
            className="tw-form-inputs tw-form-inputs-padding"
            data-testid="private-key-id"
            id="private-key-id"
            name="private-key-id"
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
            {t('label.private-key')}
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            {t('label.google-cloud-private-key')}
          </p>
          <Input.Password
            className="tw-form-inputs tw-form-inputs-padding"
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
            {t('label.client-email')}
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            {t('label.google-cloud-email')}
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
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
            {t('label.client-id')}
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            {t('label.google-client-id')}
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
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
            {t('label.authentication-uri')}
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            {t('label.google-cloud-auth-uri')}
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
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
            {t('label.token-uri')}
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            {t('label.google-cloud-token-uri')}
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
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
            {t('label.auth-x509-certificate-url')}
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            {t('label.google-cloud-auth-provider')}
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
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
            {t('label.client-x509-certificate-url')}
          </label>
          <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
            {t('label.google-cloud-client-certificate-uri')}
          </p>
          <input
            className="tw-form-inputs tw-form-inputs-padding"
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
          {t('label.gcs-credential-path')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          {`${t('label.gcs-credential-path')}.`}
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
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
          {t('label.dbt-configuration-source')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-sm">
          {t('message.fetch-dbt-files')}
        </p>
        <Select
          className="tw-form-inputs"
          data-testid="gcs-config"
          id="gcs-config"
          options={GCSCreds}
          placeholder={t('message.select-gcs-config-type')}
          value={gcsType}
          onChange={(value) => {
            handleGcsTypeChange && handleGcsTypeChange(value as GCS_CONFIG);
          }}
        />
      </Field>
      {gcsType === GCS_CONFIG.GCSValues
        ? gcsCredConfigs(dbtSecurityConfig?.gcsConfig as GCSCredentialsValues)
        : gcsCredPath(dbtSecurityConfig?.gcsConfig as string)}
      <Field>
        <label
          className="tw-block tw-form-label tw-mb-1"
          htmlFor="dbt-bucket-name">
          {t('label.dbt-bucket-name')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          {t('message.name-of-the-bucket-dbt-files-stored')}
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
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
          {t('label.dbt-object-prefix')}
        </label>
        <p className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs">
          {t('message.path-of-the-dbt-files-stored')}
        </p>
        <input
          className="tw-form-inputs tw-form-inputs-padding"
          data-testid="dbt-object-prefix"
          id="dbt-object-prefix"
          name="dbt-object-prefix"
          type="text"
          value={dbtPrefixConfig?.dbtObjectPrefix}
          onChange={(e) => updateDbtBucket('dbtObjectPrefix', e.target.value)}
        />
      </Field>

      {getSeparator('')}

      <DBTCommonFields
        dbtClassificationName={dbtClassificationName}
        dbtUpdateDescriptions={dbtUpdateDescriptions}
        descriptionId="gcs-update-description"
        enableDebugLog={enableDebugLog}
        handleEnableDebugLogCheck={handleEnableDebugLogCheck}
        handleUpdateDBTClassification={handleUpdateDBTClassification}
        handleUpdateDescriptions={handleUpdateDescriptions}
      />

      {getSeparator('')}

      <Field className="d-flex justify-end">
        <Button
          className="m-r-xs"
          data-testid="back-button"
          type="link"
          onClick={onCancel}>
          {cancelText}
        </Button>

        <Button
          className="font-medium p-x-md p-y-xxs h-auto rounded-6"
          data-testid="submit-btn"
          type="primary"
          onClick={handleSubmit}>
          {okText}
        </Button>
      </Field>
    </Fragment>
  );
};
