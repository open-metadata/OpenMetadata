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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Form, { FormProps } from '@rjsf/core';
import classNames from 'classnames';
import { debounce, isEmpty } from 'lodash';
import { LoadingState } from 'Models';
import React, { FunctionComponent, useCallback, useState } from 'react';
import { ConfigData } from '../../../interface/service.interface';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { Button } from '../../buttons/Button/Button';
import { ArrayFieldTemplate } from '../../JSONSchemaTemplate/ArrayFieldTemplate';
import { ObjectFieldTemplate } from '../../JSONSchemaTemplate/ObjectFieldTemplate';
import Loader from '../../Loader/Loader';

interface Props extends FormProps<ConfigData> {
  okText: string;
  cancelText: string;
  showFormHeader?: boolean;
  status?: LoadingState;
  onCancel?: () => void;
  onTestConnection?: (formData: ConfigData) => Promise<void>;
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
  onTestConnection,
  ...props
}: Props) => {
  let oForm: Form<ConfigData> | null;
  const [localFormData, setLocalFormData] = useState<ConfigData | undefined>(
    formData
  );
  const [connectionTesting, setConnectionTesting] = useState<boolean>(false);
  const [connectionTestingState, setConnectionTestingState] =
    useState<LoadingState>('initial');

  const handleCancel = () => {
    setLocalFormData(formData);
    if (onCancel) {
      onCancel();
    }
  };

  const handleSubmit = () => {
    if (oForm?.submit) {
      oForm.submit();
    }
  };

  const handleTestConnection = () => {
    if (localFormData && onTestConnection) {
      setConnectionTesting(true);
      setConnectionTestingState('waiting');
      onTestConnection(localFormData)
        .then(() => {
          setTimeout(() => {
            setConnectionTestingState('success');
          }, 500);
        })
        .catch(() => {
          setTimeout(() => {
            setConnectionTestingState('initial');
          }, 500);
        })
        .finally(() => {
          setTimeout(() => {
            setConnectionTesting(false);
          }, 500);
        });
    }
  };
  const debouncedOnChange = useCallback(
    (updatedData: ConfigData): void => {
      setLocalFormData(updatedData);
    },
    [setLocalFormData]
  );

  const debounceOnSearch = useCallback(debounce(debouncedOnChange, 400), [
    debouncedOnChange,
  ]);
  const handleChange = (updatedData: ConfigData) => {
    debounceOnSearch(updatedData);
  };

  const getConnectionTestingMessage = () => {
    switch (connectionTestingState) {
      case 'waiting':
        return (
          <div className="tw-flex">
            <Loader size="small" type="default" />{' '}
            <span className="tw-ml-2">Testing Connection</span>
          </div>
        );
      case 'success':
        return (
          <div className="tw-flex">
            <SVGIcons alt="success-badge" icon={Icons.SUCCESS_BADGE} />
            <span className="tw-ml-2">Connection test was successful</span>
          </div>
        );

      case 'initial':
      default:
        return 'Test your connections before creating service';
    }
  };

  return (
    <Form
      ArrayFieldTemplate={ArrayFieldTemplate}
      ObjectFieldTemplate={ObjectFieldTemplate}
      className={classNames('rjsf', props.className, {
        'no-header': !showFormHeader,
      })}
      formData={localFormData}
      ref={(form) => {
        oForm = form;
      }}
      schema={schema}
      onChange={(e) => {
        handleChange(e.formData);
        props.onChange && props.onChange(e);
      }}
      onSubmit={onSubmit}
      {...props}>
      {isEmpty(schema) && (
        <div className="tw-text-grey-muted tw-text-center">
          No Connection Configs available.
        </div>
      )}
      {!isEmpty(schema) && onTestConnection && (
        <div className="tw-flex tw-justify-between tw-bg-white tw-border tw-border-main tw-shadow tw-rounded tw-p-3 tw-mt-4">
          <div className="tw-self-center">{getConnectionTestingMessage()}</div>
          <Button
            className={classNames('tw-self-center tw-py-1 tw-px-1.5', {
              'tw-opacity-40': connectionTesting,
            })}
            data-testid="test-connection-btn"
            disabled={connectionTesting}
            size="small"
            theme="primary"
            variant="outlined"
            onClick={handleTestConnection}>
            Test Connection
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
              <FontAwesomeIcon icon="check" />
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
