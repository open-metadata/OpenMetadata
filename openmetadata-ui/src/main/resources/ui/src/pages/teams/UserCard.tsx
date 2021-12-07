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
import React from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../../components/common/avatar/Avatar';
import { SearchIndex } from '../../enums/search.enum';
import { getPartialNameFromFQN } from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { getEntityLink } from '../../utils/TableUtils';

type Props = {
  item: { description: string; name: string; id?: string };
  isActionVisible?: boolean;
  isIconVisible?: boolean;
  isDataset?: boolean;
  isCheckBoxes?: boolean;
  onSelect?: (value: string) => void;
  onRemove?: (value: string) => void;
};

enum DatasetType {
  TABLE = 'table',
  TOPIC = 'topic',
  DASHBOARD = 'dashboard',
}

const UserCard = ({
  item,
  isActionVisible = false,
  isIconVisible = false,
  isDataset = false,
  isCheckBoxes = false,
  onSelect,
  onRemove,
}: Props) => {
  const getArrForPartialName = (
    type: string
  ): Array<'service' | 'database' | 'table' | 'column'> => {
    switch (type) {
      case DatasetType.TABLE:
        return ['database', 'table'];
      case DatasetType.TOPIC:
      case DatasetType.DASHBOARD:
      default:
        return ['service', 'database', 'table'];
    }
  };

  const getDatasetIcon = (type: string) => {
    let icon = '';
    switch (type) {
      case DatasetType.TOPIC:
        icon = Icons.TOPIC;

        break;
      case DatasetType.DASHBOARD:
        icon = Icons.DASHBOARD;

        break;
      case DatasetType.TABLE:
      default:
        icon = Icons.TABLE;

        break;
    }

    return (
      <SVGIcons
        alt="icon"
        className={classNames('tw-h-4 tw-w-4', {
          'tw-mt-0.5': type !== DatasetType.DASHBOARD,
        })}
        icon={icon}
      />
    );
  };

  const getDatasetTitle = (type: string, fqn: string) => {
    let link = '';
    switch (type) {
      case DatasetType.TOPIC:
        link = getEntityLink(SearchIndex.TOPIC, fqn);

        break;
      case DatasetType.DASHBOARD:
        link = getEntityLink(SearchIndex.DASHBOARD, fqn);

        break;
      case DatasetType.TABLE:
      default:
        link = getEntityLink(SearchIndex.TABLE, fqn);

        break;
    }

    return (
      <Link data-testid="dataset-link" to={link}>
        <button className="tw-font-normal tw-text-grey-body tw-break-all">
          {getPartialNameFromFQN(fqn, getArrForPartialName(type))}
        </button>
      </Link>
    );
  };

  return (
    <div
      className={classNames(
        'tw-card tw-flex tw-justify-between tw-py-2 tw-px-3 tw-group',
        { 'tw-py-5': isDataset }
      )}
      data-testid="user-card-container">
      <div className={`tw-flex ${isCheckBoxes ? 'tw-mr-2' : 'tw-gap-1'}`}>
        {isIconVisible && !isDataset ? (
          <Avatar name={item.description} />
        ) : (
          <>{getDatasetIcon(item.name)}</>
        )}

        <div
          className={classNames('tw-flex tw-flex-col', {
            'tw-pl-2': !isDataset,
          })}
          data-testid="data-container">
          {isDataset ? (
            <>{getDatasetTitle(item.name, item.description)}</>
          ) : (
            <>
              <p className="tw-font-normal">{item.description}</p>
              <p>{isIconVisible ? item.name : capitalize(item.name)}</p>
            </>
          )}
        </div>
      </div>
      {isActionVisible && (
        <div className="tw-flex-none">
          {isCheckBoxes ? (
            <input
              className="tw-px-2 custom-checkbox"
              data-testid="checkboxAddUser"
              type="checkbox"
              onChange={() => {
                onSelect?.(item.id as string);
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
                width="12px"
              />
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default UserCard;
