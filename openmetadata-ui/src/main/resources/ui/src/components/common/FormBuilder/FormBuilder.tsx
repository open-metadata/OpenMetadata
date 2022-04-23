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
import Form, {
  ArrayFieldTemplateProps,
  FormProps,
  ObjectFieldTemplateProps,
} from '@rjsf/core';
import classNames from 'classnames';
import { debounce, isEmpty } from 'lodash';
import { LoadingState } from 'Models';
import React, {
  Fragment,
  FunctionComponent,
  useCallback,
  useState,
} from 'react';
import { ConfigData } from '../../../interface/service.interface';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { Button } from '../../buttons/Button/Button';
import Loader from '../../Loader/Loader';

interface Props extends FormProps<ConfigData> {
  okText: string;
  cancelText: string;
  showFormHeader?: boolean;
  status?: LoadingState;
  onCancel?: () => void;
  onTestConnection?: (formData: ConfigData) => Promise<void>;
}

function ArrayFieldTemplate(props: ArrayFieldTemplateProps) {
  return (
    <Fragment>
      <div className="tw-flex tw-justify-between tw-items-center">
        <div>
          <label className="control-label">{props.title}</label>
          <p className="field-description">{props.schema.description}</p>
        </div>
        {props.canAdd && (
          <Button
            className="tw-h-7 tw-w-7 tw-px-2"
            data-testid={`add-item-${props.title}`}
            size="small"
            theme="primary"
            variant="contained"
            onClick={props.onAddClick}>
            <FontAwesomeIcon icon="plus" />
          </Button>
        )}
      </div>
      {props.items.map((element, index) => (
        <div
          className={classNames('tw-flex tw-items-center tw-w-full', {
            'tw-mt-2': index > 0,
          })}
          key={`${element.key}-${index}`}>
          <div className="tw-flex-1 array-fields">{element.children}</div>
          {element.hasRemove && (
            <button
              className="focus:tw-outline-none tw-w-7 tw-ml-3"
              type="button"
              onClick={(event) => {
                element.onDropIndexClick(element.index)(event);
              }}>
              <SVGIcons
                alt="delete"
                icon={Icons.DELETE}
                title="Delete"
                width="14px"
              />
            </button>
          )}
        </div>
      ))}
    </Fragment>
  );
}

function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  return (
    <Fragment>
      <div className="tw-flex tw-justify-between tw-items-center">
        <div>
          <label className="control-label" id={`${props.idSchema.$id}__title`}>
            {props.title}
          </label>
          <p
            className="field-description"
            id={`${props.idSchema.$id}__description`}>
            {props.description}
          </p>
        </div>
        {props.schema.additionalProperties && (
          <Button
            className="tw-h-7 tw-w-7 tw-px-2"
            data-testid={`add-item-${props.title}`}
            id={`${props.idSchema.$id}__add`}
            size="small"
            theme="primary"
            variant="contained"
            onClick={() => {
              props.onAddClick(props.schema)();
            }}>
            <FontAwesomeIcon icon="plus" />
          </Button>
        )}
      </div>
      {props.properties.map((element, index) => (
        <div
          className={classNames('property-wrapper', {
            'additional-fields': props.schema.additionalProperties,
          })}
          key={`${element.content.key}-${index}`}>
          {element.content}
        </div>
      ))}
    </Fragment>
  );
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
      onTestConnection(localFormData).finally(() => {
        setConnectionTesting(false);
      });
    }
  };
  const debouncedOnChange = useCallback(
    (updatedData: ConfigData): void => {
      setLocalFormData(updatedData);
    },
    [setLocalFormData]
  );

  const debounceOnSearch = useCallback(debounce(debouncedOnChange, 1500), [
    debouncedOnChange,
  ]);
  const handleChange = (updatedData: ConfigData) => {
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
          No Connection Configs available.
        </div>
      )}
      <div className="tw-mt-6 tw-flex tw-justify-between">
        <div>
          {!isEmpty(schema) && onTestConnection && (
            <Button
              className={classNames({
                'tw-opacity-40': connectionTesting,
              })}
              data-testid="test-connection-btn"
              disabled={connectionTesting}
              size="regular"
              theme="primary"
              variant="outlined"
              onClick={handleTestConnection}>
              Test Connection
            </Button>
          )}
        </div>
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
