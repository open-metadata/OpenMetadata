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
import { capitalize } from 'lodash';
import { FormattedUsersData } from 'Models';
import React, { useState } from 'react';
import ProfilePicture from '../../components/common/ProfilePicture/ProfilePicture';
import SVGIcons from '../../utils/SvgUtils';

type Props = {
  item: Pick<FormattedUsersData, 'displayName' | 'id' | 'name' | 'type'> & {
    email?: string;
    isChecked: boolean;
  };
  isActionVisible?: boolean;
  isIconVisible?: boolean;
  isCheckBoxes?: boolean;
  onSelect?: (value: string, isChecked: boolean) => void;
  onRemove?: (value: string) => void;
};

const CheckboxUserCard = ({
  item,
  isActionVisible = false,
  isIconVisible = false,
  isCheckBoxes = false,
  onSelect,
  onRemove,
}: Props) => {
  const [isChecked, setIsChecked] = useState(item.isChecked);

  return (
    <div
      className={classNames(
        'tw-card tw-flex tw-justify-between tw-py-2 tw-px-3 tw-group'
      )}
      data-testid="user-card-container">
      {isIconVisible && (
        <div className="tw-flex tw-mr-2">
          <ProfilePicture
            displayName={item.displayName || item.name}
            id={item.id || ''}
            name={item.name || ''}
          />
        </div>
      )}
      <div
        className={classNames('tw-flex tw-justify-center tw-flex-col')}
        data-testid="data-container">
        <>
          <p
            className={classNames(
              'tw-font-normal',
              isActionVisible ? 'tw-truncate tw-w-32' : null
            )}
            title={item.displayName}>
            {item.displayName}
          </p>
          {item.name && (
            <p
              className={classNames(
                isActionVisible ? 'tw-truncate tw-w-32' : null
              )}
              title={isIconVisible ? item.name : capitalize(item.name)}>
              {isIconVisible ? item.name : capitalize(item.name)}
            </p>
          )}
        </>
      </div>
      {isActionVisible && (
        <div className="tw-flex-none">
          {isCheckBoxes ? (
            <input
              checked={isChecked}
              className="tw-p-1 custom-checkbox"
              data-testid="checkboxAddUser"
              type="checkbox"
              onChange={(e) => {
                setIsChecked(e.target.checked);
                onSelect?.(item.id as string, e.target.checked);
              }}
            />
          ) : (
            <span
              data-testid="remove"
              onClick={() => onRemove?.(item.id as string)}>
              <SVGIcons
                alt="delete"
                className="tw-text-gray-500 tw-cursor-pointer tw-opacity-0 hover:tw-text-gray-700 group-hover:tw-opacity-100"
                icon="icon-delete"
                title="Remove"
                width="16px"
              />
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default CheckboxUserCard;
