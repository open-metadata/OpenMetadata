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
import { capitalize } from 'lodash';
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import Avatar from '../../components/common/avatar/Avatar';
import NonAdminAction from '../../components/common/non-admin-action/NonAdminAction';
import { AssetsType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import { useAuth } from '../../hooks/authHooks';
import {
  getPartialNameFromFQN,
  getPartialNameFromTableFQN,
} from '../../utils/CommonUtils';
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

const UserCard = ({
  item,
  isActionVisible = false,
  isIconVisible = false,
  isDataset = false,
  isCheckBoxes = false,
  onSelect,
  onRemove,
}: Props) => {
  const { isAdminUser, userPermissions } = useAuth();
  const { isAuthDisabled } = useAuthContext();

  /**
   * prepare asset displayname and return it
   * @param type - asset type
   * @param fqn - asset fqn
   * @returns - displayname
   */
  const getAssetDisplayName = (type: string, fqn: string) => {
    switch (type) {
      case AssetsType.TABLE:
        return getPartialNameFromTableFQN(fqn, ['database', 'table']);

      case AssetsType.DASHBOARD:
      case AssetsType.PIPELINE:
      case AssetsType.TOPIC:
      default:
        return getPartialNameFromFQN(fqn, ['service', 'database']);
    }
  };

  const getDatasetIcon = (type: string) => {
    let icon = '';
    switch (type) {
      case AssetsType.TOPIC:
        icon = Icons.TOPIC;

        break;
      case AssetsType.DASHBOARD:
        icon = Icons.DASHBOARD;

        break;
      case AssetsType.PIPELINE:
        icon = Icons.PIPELINE;

        break;
      case AssetsType.TABLE:
      default:
        icon = Icons.TABLE;

        break;
    }

    return (
      <SVGIcons
        alt="icon"
        className={classNames('tw-h-4 tw-w-4', {
          'tw-mt-0.5': type !== AssetsType.DASHBOARD,
        })}
        icon={icon}
      />
    );
  };

  const getDatasetTitle = (type: string, fqn: string) => {
    let link = '';
    switch (type) {
      case AssetsType.TOPIC:
        link = getEntityLink(SearchIndex.TOPIC, fqn);

        break;
      case AssetsType.PIPELINE:
        link = getEntityLink(SearchIndex.PIPELINE, fqn);

        break;
      case AssetsType.DASHBOARD:
        link = getEntityLink(SearchIndex.DASHBOARD, fqn);

        break;
      case AssetsType.TABLE:
      default:
        link = getEntityLink(SearchIndex.TABLE, fqn);

        break;
    }

    return (
      <Link data-testid="dataset-link" to={link}>
        <button className="tw-font-medium tw-text-grey-body tw-break-all">
          {getAssetDisplayName(type, fqn)}
        </button>
      </Link>
    );
  };

  return (
    <div
      className={classNames(
        'tw-card tw-flex tw-justify-between tw-py-2 tw-px-3 tw-group',
        { 'tw-py-5 tw-items-center': isDataset }
      )}
      data-testid="user-card-container">
      <div className={`tw-flex ${isCheckBoxes ? 'tw-mr-2' : 'tw-gap-1'}`}>
        {isIconVisible && !isDataset ? (
          <Avatar name={item.description} />
        ) : (
          <>{getDatasetIcon(item.name)}</>
        )}

        <div
          className={classNames('tw-flex tw-justify-center tw-flex-col', {
            'tw-pl-2': !isDataset,
          })}
          data-testid="data-container">
          {isDataset ? (
            <>{getDatasetTitle(item.name, item.description)}</>
          ) : (
            <>
              <p
                className={classNames(
                  'tw-font-normal',
                  isActionVisible ? 'tw-truncate tw-w-32' : null
                )}
                title={item.description}>
                {item.description}
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
          )}
        </div>
      </div>
      {isActionVisible && (
        <div className="tw-flex-none">
          {isCheckBoxes ? (
            <input
              className="tw-p-1 custom-checkbox"
              data-testid="checkboxAddUser"
              type="checkbox"
              onChange={() => {
                onSelect?.(item.id as string);
              }}
            />
          ) : (
            <NonAdminAction
              html={<>You do not have permission to update the team.</>}
              permission={Operation.UpdateTeam}
              position="bottom">
              <span
                className={classNames('tw-h-8 tw-rounded tw-mb-3', {
                  'tw-opacity-40':
                    !isAdminUser &&
                    !isAuthDisabled &&
                    !userPermissions[Operation.UpdateTeam],
                })}
                data-testid="remove"
                onClick={() => onRemove?.(item.id as string)}>
                <FontAwesomeIcon
                  className="tw-cursor-pointer tw-opacity-0 group-hover:tw-opacity-100"
                  icon="remove"
                />
              </span>
            </NonAdminAction>
          )}
        </div>
      )}
    </div>
  );
};

export default UserCard;
