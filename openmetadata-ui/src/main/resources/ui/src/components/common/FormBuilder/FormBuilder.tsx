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
import CoreForm, { FormProps } from '@rjsf/core';
import { ErrorTransformer } from '@rjsf/utils';
import classNames from 'classnames';
import { t } from 'i18next';
import { isEmpty, startCase } from 'lodash';
import { LoadingState } from 'Models';
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { getPipelineServiceHostIp } from 'rest/ingestionPipelineAPI';
import { ConfigData } from '../../../interface/service.interface';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { Button } from '../../buttons/Button/Button';
import { ArrayFieldTemplate } from '../../JSONSchemaTemplate/ArrayFieldTemplate';
import { ObjectFieldTemplate } from '../../JSONSchemaTemplate/ObjectFieldTemplate';
import Loader from '../../Loader/Loader';

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
  isAirflowAvailable: boolean;
  showFormHeader?: boolean;
  status?: LoadingState;
  onCancel?: () => void;
  onTestConnection?: (formData: ConfigData) => Promise<void>;
  disableTestConnection: boolean;
}

const FormBuilder: FunctionComponent<Props> = ({
  schema,
  okText,
  cancelText,
  showFormHeader = false,
  status = 'initial',
  onCancel,
  onSubmit,
  onTestConnection,
  uiSchema,
  isAirflowAvailable,
  disableTestConnection,
  onChange,
  ...props
}: Props) => {
  const formRef = useRef<CoreForm<ConfigData>>(null);
  const [connectionTesting, setConnectionTesting] = useState<boolean>(false);
  const [connectionTestingState, setConnectionTestingState] =
    useState<LoadingState>('initial');

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

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
    }
  }, [onCancel]);

  const handleSubmit = useCallback(() => {
    if (formRef.current) {
      formRef.current.submit();
    }
  }, []);

  const handleTestConnection = useCallback(() => {
    if (onTestConnection && formRef.current?.state.formData) {
      setConnectionTesting(true);
      setConnectionTestingState('waiting');
      onTestConnection(formRef.current?.state.formData)
        .then(() => {
          setConnectionTestingState('success');
        })
        .catch(() => {
          setConnectionTestingState('initial');
        })
        .finally(() => {
          setConnectionTesting(false);
        });
    }
  }, [setConnectionTesting, onTestConnection, setConnectionTestingState]);

  const getConnectionTestingMessage = useCallback(() => {
    switch (connectionTestingState) {
      case 'waiting':
        return (
          <div className="tw-flex">
            <Loader size="small" type="default" />{' '}
            <span className="tw-ml-2">{t('label.testing-connection')}</span>
          </div>
        );
      case 'success':
        return (
          <div className="tw-flex">
            <SVGIcons
              alt="success-badge"
              icon={Icons.SUCCESS_BADGE}
              width={24}
            />
            <span className="tw-ml-2">
              {t('message.connection-test-successful')}
            </span>
          </div>
        );

      case 'initial':
      default:
        return t('message.test-your-connection-before-creating-service');
    }
  }, [connectionTestingState]);

  const content = useMemo(() => {
    return (
      <>
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
        {!isEmpty(schema) && onTestConnection && (
          <div className="tw-flex tw-justify-between tw-bg-white tw-border tw-border-main tw-shadow tw-rounded tw-p-3 tw-mt-4">
            <div className="tw-self-center">
              {getConnectionTestingMessage()}
            </div>
            <Button
              className={classNames('tw-self-center tw-py-1 tw-px-1.5', {
                'tw-opacity-40': connectionTesting,
              })}
              data-testid="test-connection-btn"
              disabled={connectionTesting || disableTestConnection}
              size="small"
              theme="primary"
              variant="outlined"
              onClick={handleTestConnection}>
              {t('label.test-entity', { entity: t('label.connection') })}
            </Button>
          </div>
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
      </>
    );
  }, [
    getConnectionTestingMessage,
    handleSubmit,
    handleCancel,
    handleTestConnection,
    disableTestConnection,
    connectionTesting,
    onTestConnection,
    schema,
    okText,
    hostIp,
    isAirflowAvailable,
    status,
  ]);

  return (
    <CoreForm
      className={classNames('rjsf', props.className, {
        'no-header': !showFormHeader,
      })}
      ref={formRef}
      schema={schema}
      showErrorList={false}
      templates={{
        ArrayFieldTemplate: ArrayFieldTemplate,
        ObjectFieldTemplate: ObjectFieldTemplate,
      }}
      transformErrors={transformErrors}
      uiSchema={uiSchema}
      onChange={onChange}
      onSubmit={onSubmit}
      {...props}>
      {content}
    </CoreForm>
  );
};

export default FormBuilder;
