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
import { DatabaseServiceMetadataPipelineClass } from '../../../generated/metadataIngestion/databaseServiceMetadataPipeline';
import { Button } from '../../buttons/Button/Button';
import { ArrayFieldTemplate } from '../../JSONSchemaTemplate/ArrayFieldTemplate';
import { ObjectFieldTemplate } from '../../JSONSchemaTemplate/ObjectFieldTemplate';
import Loader from '../../Loader/Loader';

interface Props extends FormProps<DatabaseServiceMetadataPipelineClass> {
  okText: string;
  cancelText: string;
  showFormHeader?: boolean;
  status?: LoadingState;
  onCancel?: () => void;
}

const DBTConfigFormBuilder: FunctionComponent<Props> = ({
  formData,
  schema,
  okText,
  cancelText,
  showFormHeader = false,
  status = 'initial',
  onCancel,
  onSubmit,
  ...props
}: Props) => {
  let oForm: Form<DatabaseServiceMetadataPipelineClass> | null;
  const [localFormData, setLocalFormData] = useState<
    DatabaseServiceMetadataPipelineClass | undefined
  >(formData);

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

  const debouncedOnChange = useCallback(
    (updatedData: DatabaseServiceMetadataPipelineClass): void => {
      setLocalFormData(updatedData);
    },
    [setLocalFormData]
  );

  const debounceOnSearch = useCallback(debounce(debouncedOnChange, 1500), [
    debouncedOnChange,
  ]);
  const handleChange = (updatedData: DatabaseServiceMetadataPipelineClass) => {
    debounceOnSearch(updatedData);
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
          No DBT Configs available.
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

export default DBTConfigFormBuilder;
