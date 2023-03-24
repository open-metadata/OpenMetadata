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
import Form from '@rjsf/antd';
import CoreForm, { AjvError, FormProps, IChangeEvent } from '@rjsf/core';
import classNames from 'classnames';
import { ServiceCategory } from 'enums/service.enum';
import { useAirflowStatus } from 'hooks/useAirflowStatus';
import { t } from 'i18next';
import { isEmpty, isUndefined, startCase } from 'lodash';
import { LoadingState } from 'Models';
import React, { FunctionComponent, useEffect, useRef, useState } from 'react';
import { getPipelineServiceHostIp } from 'rest/ingestionPipelineAPI';
import { ConfigData } from '../../../interface/service.interface';
import { formatFormDataForRender } from '../../../utils/JSONSchemaFormUtils';
import { Button } from '../../buttons/Button/Button';
import { ArrayFieldTemplate } from '../../JSONSchemaTemplate/ArrayFieldTemplate';
import { ObjectFieldTemplate } from '../../JSONSchemaTemplate/ObjectFieldTemplate';
import Loader from '../../Loader/Loader';
import TestConnection from '../TestConnection/TestConnection';

interface Props extends FormProps<ConfigData> {
  okText: string;
  cancelText: string;
  disableTestConnection: boolean;
  serviceType: string;
  serviceCategory: ServiceCategory;
  showFormHeader?: boolean;
  status?: LoadingState;
  onCancel?: () => void;
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
  serviceCategory,
  serviceType,
  ...props
}: Props) => {
  const { isAirflowAvailable } = useAirflowStatus();

  const formRef = useRef<CoreForm<ConfigData>>();
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

  const handleSubmit = () => {
    if (formRef.current) {
      formRef.current.submit();
    }
  };

  const handleChange = (updatedData: ConfigData) => {
    setLocalFormData(updatedData);
  };

  const transformErrors = (errors: AjvError[]) =>
    errors.map((error) => {
      const fieldName = error.params.missingProperty;
      const customMessage = `${startCase(fieldName)} is required`;
      error.message = customMessage;

      return error;
    });

  return (
    <Form
      ArrayFieldTemplate={ArrayFieldTemplate}
      ObjectFieldTemplate={ObjectFieldTemplate}
      className={classNames('rjsf', props.className, {
        'no-header': !showFormHeader,
      })}
      formData={localFormData}
      ref={formRef}
      schema={schema}
      showErrorList={false}
      transformErrors={transformErrors}
      uiSchema={uiSchema}
      onChange={(e: IChangeEvent) => {
        handleChange(e.formData);
        props.onChange && props.onChange(e);
      }}
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
        />
      )}
      <div className="tw-mt-6 tw-flex tw-justify-between">
        <div />
        <div className="tw-text-right" data-testid="buttons">
          <Button
            size="regular"
            theme="primary"
            variant="text"
            onClick={handleCancel}>
            {cancelText}
          </Button>
          {status === 'waiting' ? (
            <Button
              disabled
              className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
              size="regular"
              theme="primary"
              variant="contained">
              <Loader size="small" type="white" />
            </Button>
          ) : status === 'success' ? (
            <Button
              disabled
              className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
              size="regular"
              theme="primary"
              variant="contained">
              <CheckOutlined />
            </Button>
          ) : (
            <Button
              className="tw-w-16 tw-h-10"
              data-testid="submit-btn"
              size="regular"
              theme="primary"
              variant="contained"
              onClick={handleSubmit}>
              {okText}
            </Button>
          )}
        </div>
      </div>
    </Form>
  );
};

export default FormBuilder;
