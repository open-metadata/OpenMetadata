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
import classNames from 'classnames';
import React, { ChangeEvent, FC, Fragment, useState } from 'react';
import { Table } from '../../../generated/entity/data/table';
import { EntityReference } from '../../../generated/type/entityReference';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { Button } from '../../buttons/Button/Button';

interface Props {
  propertyName: string;
  propertyType: EntityReference;
  extension: Table['extension'];
  onExtensionUpdate: (updatedExtension: Table['extension']) => void;
}

interface PropertInputProps extends Pick<Props, 'propertyName'> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  value: any;
  type: string;
  onCancel: () => void;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  onSave: (value: any) => void;
}

const EditIcon = ({ onShowInput }: { onShowInput: () => void }) => (
  <span className="tw-cursor-pointer tw-ml-1" onClick={onShowInput}>
    <SVGIcons alt="edit" icon={Icons.EDIT} width="12px" />
  </span>
);

const PropertyInput: FC<PropertInputProps> = ({
  value,
  onCancel,
  type,
  propertyName,
  onSave,
}) => {
  const inputType = type === 'string' ? 'text' : 'number';

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [inputValue, setInputValue] = useState<any>(value || '');

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;

    setInputValue(value);
  };

  const handleSave = () => {
    onSave(inputValue);
  };

  return (
    <div className="tw-flex tw-items-center tw-gap-1">
      <input
        className="tw-form-inputs tw-form-inputs-padding tw-py-0.5 tw-w-64"
        data-testid="value"
        id="value"
        name={propertyName}
        placeholder="value"
        type={inputType}
        value={inputValue}
        onChange={onChange}
      />
      <div className="tw-flex tw-justify-end" data-testid="buttons">
        <Button
          className="tw-px-1 tw-py-1 tw-rounded tw-text-sm tw-mr-1"
          data-testid="cancel-value"
          size="custom"
          theme="primary"
          variant="contained"
          onMouseDown={onCancel}>
          <FontAwesomeIcon className="tw-w-3.5 tw-h-3.5" icon="times" />
        </Button>
        <Button
          className="tw-px-1 tw-py-1 tw-rounded tw-text-sm"
          data-testid="save-value"
          size="custom"
          theme="primary"
          variant="contained"
          onClick={handleSave}>
          <FontAwesomeIcon className="tw-w-3.5 tw-h-3.5" icon="check" />
        </Button>
      </div>
    </div>
  );
};

export const PropertyValue: FC<Props> = ({
  propertyName,
  extension,
  propertyType,
  onExtensionUpdate,
}) => {
  const value = extension?.[propertyName];

  const [showInput, setShowInput] = useState<boolean>(false);

  const onShowInput = () => {
    setShowInput(true);
  };

  const onHideInput = () => {
    setShowInput(false);
  };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const onInputSave = (value: any) => {
    const updatedExtension = { ...(extension || {}), [propertyName]: value };
    onExtensionUpdate(updatedExtension);
  };

  const valueElement = (
    <div className={classNames({ 'tw-text-grey-body': Boolean(value) })}>
      {showInput ? (
        <PropertyInput
          propertyName={propertyName}
          type={propertyType.name as string}
          value={value}
          onCancel={onHideInput}
          onSave={onInputSave}
        />
      ) : (
        <Fragment>
          <span>
            {value || <span className="tw-text-grey-body">No data</span>}
          </span>
          <EditIcon onShowInput={onShowInput} />
        </Fragment>
      )}
    </div>
  );

  return valueElement;
};
