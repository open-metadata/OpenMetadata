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
import { LoadingState } from 'Models';
import React, { Fragment, FunctionComponent } from 'react';
import { ConfigData } from '../../../interface/service.interface';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { Button } from '../../buttons/Button/Button';
import Loader from '../../Loader/Loader';

interface Props extends FormProps<ConfigData> {
  showFormHeader?: boolean;
  status?: LoadingState;
  onCancel?: () => void;
}

function ArrayFieldTemplate(props: ArrayFieldTemplateProps) {
  return (
    <>
      <label className="control-label">{props.title}</label>
      <p className="field-description">{props.schema.description}</p>
      {props.items.map((element, index) => (
        <div className="tw-flex tw-items-center tw-w-full" key={index}>
          <div className="tw-flex-1">{element.children}</div>
          {element.hasRemove && (
            <button
              className="focus:tw-outline-none tw-w-1/12"
              type="button"
              onClick={(event) => {
                element.onDropIndexClick(element.index)(event);
              }}>
              <SVGIcons
                alt="delete"
                icon={Icons.DELETE}
                title="Delete"
                width="16px"
              />
            </button>
          )}
        </div>
      ))}
      {props.canAdd && (
        <Button
          className="tw-h-7 tw-px-2 tw-mb-3"
          data-testid={`add-item-${props.title}`}
          size="small"
          theme="primary"
          variant="contained"
          onClick={props.onAddClick}>
          <FontAwesomeIcon icon="plus" />
        </Button>
      )}
    </>
  );
}

function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  return (
    <Fragment>
      <label className="control-label">{props.title}</label>
      <p className="field-description">{props.description}</p>
      {props.properties.map((element) => (
        <div className="property-wrapper" key={element.content.key}>
          {element.content}
        </div>
      ))}
      {props.schema.additionalProperties && (
        <Button
          className="tw-h-7 tw-px-2 tw-mb-3"
          data-testid={`add-item-${props.title}`}
          size="small"
          theme="primary"
          variant="contained"
          onClick={() => {
            props.onAddClick(props.schema)();
          }}>
          <FontAwesomeIcon icon="plus" />
        </Button>
      )}
    </Fragment>
  );
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
      ArrayFieldTemplate={ArrayFieldTemplate}
      ObjectFieldTemplate={ObjectFieldTemplate}
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
