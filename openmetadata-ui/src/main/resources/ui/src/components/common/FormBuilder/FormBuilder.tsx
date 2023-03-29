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

import { CheckOutlined } from '@ant-design/icons';
import CoreForm, { FormProps, IChangeEvent } from '@rjsf/core';
import { ErrorTransformer } from '@rjsf/utils';
import { Button as AntDButton } from 'antd';
import classNames from 'classnames';
import { ServiceCategory } from 'enums/service.enum';
import { useAirflowStatus } from 'hooks/useAirflowStatus';
import { t } from 'i18next';
import { isEmpty, isUndefined, startCase } from 'lodash';
import { LoadingState } from 'Models';
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { getPipelineServiceHostIp } from 'rest/ingestionPipelineAPI';
import { formatFormDataForRender } from 'utils/JSONSchemaFormUtils';
import { ConfigData } from '../../../interface/service.interface';
import { ArrayFieldTemplate } from '../../JSONSchemaTemplate/ArrayFieldTemplate';
import { ObjectFieldTemplate } from '../../JSONSchemaTemplate/ObjectFieldTemplate';
import Loader from '../../Loader/Loader';
import TestConnection from '../TestConnection/TestConnection';

const transformErrors: ErrorTransformer = (errors) =>
  errors.map((error) => {
    const fieldName =
      error.params.missingProperty ?? error.params.additionalProperty;
    const customMessage = `${startCase(fieldName)} is required`;
    error.message = customMessage;

    return error;
  });

interface Props extends FormProps<ConfigData> {
  okText: string;
  cancelText: string;
  disableTestConnection: boolean;
  serviceType: string;
  serviceCategory: ServiceCategory;
  serviceName?: string;
  showFormHeader?: boolean;
  status?: LoadingState;
  onCancel?: () => void;
  onFocus: (fieldName: string) => void;
}

const FormBuilder: FunctionComponent<Props> = ({
  formData,
  schema,
  okText,
  cancelText,
  showFormHeader = false,
  status = 'initial',
  onCancel,
  onSubmit,
  uiSchema,
  disableTestConnection,
  onFocus,
  serviceCategory,
  serviceType,
  serviceName,
  onChange,
  ...props
}: Props) => {
  const { isAirflowAvailable } = useAirflowStatus();

  const formRef = useRef<CoreForm<ConfigData>>(null);
  const [localFormData, setLocalFormData] = useState<ConfigData | undefined>(
    formatFormDataForRender(formData ?? {})
  );

  const [hostIp, setHostIp] = useState<string>('[fetching]');

  const fetchHostIp = async () => {
    try {
      const data = await getPipelineServiceHostIp();
      setHostIp(data?.ip || '[unknown]');
    } catch (error) {
      setHostIp('[error - unknown]');
    }
  };

  useEffect(() => {
    if (isAirflowAvailable) {
      fetchHostIp();
    }
  }, [isAirflowAvailable]);

  const handleCancel = () => {
    setLocalFormData(formatFormDataForRender<ConfigData>(formData ?? {}));
    if (onCancel) {
      onCancel();
    }
  };

  const handleSubmit = useCallback(() => {
    if (formRef.current) {
      formRef.current.submit();
    }
  }, [onCancel]);

  const handleChange = useCallback((updatedData: ConfigData) => {
    setLocalFormData(updatedData);
  }, []);

  return (
    <CoreForm
      className={classNames('rjsf', props.className, {
        'no-header': !showFormHeader,
      })}
      formData={localFormData}
      idSeparator="/"
      ref={formRef}
      schema={schema}
      showErrorList={false}
      templates={{
        ArrayFieldTemplate: ArrayFieldTemplate,
        ObjectFieldTemplate: ObjectFieldTemplate,
      }}
      transformErrors={transformErrors}
      uiSchema={uiSchema}
      onChange={(e: IChangeEvent) => {
        handleChange(e.formData);
        onChange && onChange(e);
      }}
      onFocus={onFocus}
      onSubmit={onSubmit}
      {...props}>
      {isEmpty(schema) && (
        <div className="tw-text-grey-muted tw-text-center">
          {t('message.no-config-available')}
        </div>
      )}
      {!isEmpty(schema) && isAirflowAvailable && (
        <div
          className="tw-flex tw-justify-between tw-bg-white tw-border tw-border-main tw-shadow tw-rounded tw-p-3 tw-mt-4"
          data-testid="ip-address">
          <div className="tw-self-center">
            {t('message.airflow-host-ip-address', { hostIp })}
          </div>
        </div>
      )}
      {!isEmpty(schema) && !isUndefined(localFormData) && (
        <TestConnection
          connectionType={serviceType}
          formData={localFormData}
          isTestingDisabled={disableTestConnection}
          serviceCategory={serviceCategory}
          serviceName={serviceName}
        />
      )}
      <div className="tw-mt-6 tw-flex tw-justify-between">
        <div />
        <div className="tw-text-right" data-testid="buttons">
          <AntDButton type="link" onClick={handleCancel}>
            {cancelText}
          </AntDButton>
          {status === 'waiting' ? (
            <AntDButton
              disabled
              className="p-x-md p-y-xxs h-auto rounded-6"
              type="primary">
              <Loader size="small" type="white" />
            </AntDButton>
          ) : status === 'success' ? (
            <AntDButton
              disabled
              className="p-x-md p-y-xxs h-auto rounded-6"
              type="primary">
              <CheckOutlined />
            </AntDButton>
          ) : (
            <AntDButton
              className="font-medium p-x-md p-y-xxs h-auto rounded-6"
              data-testid="submit-btn"
              type="primary"
              onClick={handleSubmit}>
              {okText}
            </AntDButton>
          )}
        </div>
      </div>
    </CoreForm>
  );
};

export default FormBuilder;
