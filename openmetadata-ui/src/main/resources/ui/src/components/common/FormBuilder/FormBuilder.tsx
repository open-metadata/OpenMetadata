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
import { LoadingState } from 'Models';
import React, { FunctionComponent } from 'react';
import { ConfigData } from '../../../interface/service.interface';
import { Button } from '../../buttons/Button/Button';
import Loader from '../../Loader/Loader';

interface Props extends FormProps<ConfigData> {
  showFormHeader?: boolean;
  status?: LoadingState;
  onCancel?: () => void;
}

const FormBuilder: FunctionComponent<Props> = ({
  showFormHeader = false,
  status = 'initial',
  onCancel,
  onSubmit,
  ...props
}: Props) => {
  let oForm: Form<ConfigData> | null;

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  const handleSubmit = () => {
    if (oForm?.submit) {
      oForm.submit();
    }
  };

  return (
    <Form
      className={classNames('rjsf', props.className, {
        'no-header': !showFormHeader,
      })}
      ref={(form) => {
        oForm = form;
      }}
      onSubmit={onSubmit}
      {...props}>
      <div className="tw-mt-6 tw-text-right" data-testid="buttons">
        <Button
          size="regular"
          theme="primary"
          variant="text"
          onClick={handleCancel}>
          Discard
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
            data-testid="saveManageTab"
            size="regular"
            theme="primary"
            variant="contained"
            onClick={handleSubmit}>
            Save
          </Button>
        )}
      </div>
    </Form>
  );
};

export default FormBuilder;
