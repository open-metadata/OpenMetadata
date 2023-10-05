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
import Form, { FormProps, IChangeEvent } from '@rjsf/core';
import { Button } from 'antd';
import classNames from 'classnames';
import { t } from 'i18next';
import { isEmpty, isUndefined } from 'lodash';
import { LoadingState } from 'Models';
import React, { FunctionComponent, useEffect, useRef, useState } from 'react';
import { ServiceCategory } from '../../../enums/service.enum';
import { useAirflowStatus } from '../../../hooks/useAirflowStatus';
import { ConfigData } from '../../../interface/service.interface';
import { getPipelineServiceHostIp } from '../../../rest/ingestionPipelineAPI';
import { transformErrors } from '../../../utils/formUtils';
import { formatFormDataForRender } from '../../../utils/JSONSchemaFormUtils';
import { ArrayFieldTemplate } from '../../JSONSchemaTemplate/ArrayFieldTemplate';
import DescriptionFieldTemplate from '../../JSONSchemaTemplate/DescriptionFieldTemplate';
import { FieldErrorTemplate } from '../../JSONSchemaTemplate/FieldErrorTemplate/FieldErrorTemplate';
import { ObjectFieldTemplate } from '../../JSONSchemaTemplate/ObjectFieldTemplate';
import PasswordWidget from '../../JsonSchemaWidgets/PasswordWidget';
import Loader from '../../Loader/Loader';
import TestConnection from '../TestConnection/TestConnection';

interface Props extends FormProps {
  okText: string;
  cancelText: string;
  disableTestConnection: boolean;
  serviceType: string;
  serviceCategory: ServiceCategory;
  serviceName?: string;
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
  onFocus,
  serviceCategory,
  serviceType,
  serviceName,
  ...props
}: Props) => {
  const { isAirflowAvailable } = useAirflowStatus();

  const formRef = useRef<Form<ConfigData>>(null);
  const [localFormData, setLocalFormData] = useState<ConfigData | undefined>(
    formatFormDataForRender(formData ?? {})
  );

  const [hostIp, setHostIp] = useState<string>();

  const fetchHostIp = async () => {
    try {
      const { status, data } = await getPipelineServiceHostIp();
      if (status === 200) {
        setHostIp(data?.ip || '[unknown]');
      } else {
        setHostIp(undefined);
      }
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

  const handleRequiredFieldsValidation = () => {
    return Boolean(formRef.current?.validateForm());
  };

  const handleFormChange = (e: IChangeEvent<ConfigData>) => {
    setLocalFormData(e.formData);
    props.onChange && props.onChange(e);
  };

  return (
    <Form
      focusOnFirstError
      noHtml5Validate
      omitExtraData
      className={classNames('rjsf', props.className, {
        'no-header': !showFormHeader,
      })}
      formContext={{ handleFocus: onFocus }}
      formData={localFormData}
      idSeparator="/"
      ref={formRef}
      schema={schema}
      showErrorList={false}
      templates={{
        ArrayFieldTemplate: ArrayFieldTemplate,
        ObjectFieldTemplate: ObjectFieldTemplate,
        DescriptionFieldTemplate: DescriptionFieldTemplate,
        FieldErrorTemplate: FieldErrorTemplate,
      }}
      transformErrors={transformErrors}
      uiSchema={uiSchema}
      widgets={{ PasswordWidget: PasswordWidget }}
      onChange={handleFormChange}
      onFocus={onFocus}
      onSubmit={onSubmit}
      {...props}>
      {isEmpty(schema) && (
        <div className="text-grey-muted text-center">
          {t('message.no-config-available')}
        </div>
      )}
      {!isEmpty(schema) && isAirflowAvailable && hostIp && (
        <div
          className="d-flex justify-between bg-white global-border rounded-4 p-sm m-t-md"
          data-testid="ip-address">
          <div className="self-center">
            {t('message.airflow-host-ip-address', { hostIp })}
          </div>
        </div>
      )}
      {!isEmpty(schema) &&
        !isUndefined(localFormData) &&
        isAirflowAvailable && (
          <TestConnection
            connectionType={serviceType}
            formData={localFormData}
            isTestingDisabled={disableTestConnection}
            serviceCategory={serviceCategory}
            serviceName={serviceName}
            onValidateFormRequiredFields={handleRequiredFieldsValidation}
          />
        )}
      <div className="m-t-lg d-flex justify-between">
        <div />
        <div className="text-right" data-testid="buttons">
          <Button type="link" onClick={handleCancel}>
            {cancelText}
          </Button>
          {status === 'waiting' ? (
            <Button
              disabled
              className="p-x-md p-y-xxs h-auto rounded-6"
              type="primary">
              <Loader size="small" type="white" />
            </Button>
          ) : status === 'success' ? (
            <Button
              disabled
              className="p-x-md p-y-xxs h-auto rounded-6"
              type="primary">
              <CheckOutlined />
            </Button>
          ) : (
            <Button
              className="font-medium p-x-md p-y-xxs h-auto rounded-6"
              data-testid="submit-btn"
              htmlType="submit"
              type="primary">
              {okText}
            </Button>
          )}
        </div>
      </div>
    </Form>
  );
};

export default FormBuilder;
