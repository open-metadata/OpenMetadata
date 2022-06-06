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

import classNames from 'classnames';
import React, { FC, Fragment, useState } from 'react';
import { Table } from '../../../generated/entity/data/table';
import { EntityReference } from '../../../generated/type/entityReference';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { PropertyInput } from './PropertyInput';

interface Props {
  propertyName: string;
  propertyType: EntityReference;
  extension: Table['extension'];
  onExtensionUpdate: (updatedExtension: Table['extension']) => void;
}

const EditIcon = ({ onShowInput }: { onShowInput: () => void }) => (
  <span className="tw-cursor-pointer tw-ml-1" onClick={onShowInput}>
    <SVGIcons alt="edit" icon={Icons.EDIT} width="12px" />
  </span>
);

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
  const onInputSave = (updatedValue: any) => {
    const updatedExtension = {
      ...(extension || {}),
      [propertyName]: updatedValue,
    };
    onExtensionUpdate(updatedExtension);
  };

  return (
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
};
