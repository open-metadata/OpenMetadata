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
import React, { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import Ellipses from '../../components/common/Ellipses/Ellipses';
import NonAdminAction from '../../components/common/non-admin-action/NonAdminAction';
import ProfilePicture from '../../components/common/ProfilePicture/ProfilePicture';
import { AssetsType, FqnPart } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { Operation } from '../../generated/entity/policies/accessControl/rule';
import { useAuth } from '../../hooks/authHooks';
import { getPartialNameFromFQN, getPartialNameFromTableFQN } from '../../utils/CommonUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { getEntityLink } from '../../utils/TableUtils';

interface Props {
  item: {
    fqn: string;
    type: string;
    displayName: string;
    id?: string;
    name?: string;
  };
  isActionVisible?: boolean;
  isIconVisible?: boolean;
  isDataset?: boolean;
  isCheckBoxes?: boolean;
  isOwner?: boolean;
  onTitleClick?: (value: string) => void;
  onSelect?: (value: string) => void;
  onRemove?: (value: string) => void;
}

const UserCard = ({
  item,
  isActionVisible = false,
  isIconVisible = false,
  isDataset = false,
  isCheckBoxes = false,
  isOwner = false,
  onTitleClick,
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
        return getPartialNameFromTableFQN(fqn, [
          FqnPart.Database,
          FqnPart.Schema,
          FqnPart.Table,
        ]);

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
      case AssetsType.MLMODEL:
        link = getEntityLink(SearchIndex.MLMODEL, fqn);

        break;
      case AssetsType.TABLE:
      default:
        link = getEntityLink(SearchIndex.TABLE, fqn);

        break;
    }

    return (
      <Link className="tw-no-underline" data-testid="dataset-link" to={link}>
        <span className="tw-font-medium tw-text-grey-body tw-break-all tw-text-left">
          {getAssetDisplayName(type, fqn)}
        </span>
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
      <div
        className={`tw-flex ${
          isCheckBoxes ? 'tw-mr-2' : 'tw-gap-1 tw-items-center'
        }`}>
        {isIconVisible && !isDataset ? (
          <ProfilePicture
            displayName={item.displayName || item.name}
            id={item.id || ''}
            name={item.name || ''}
          />
        ) : (
          <Fragment>{getDatasetIcon(item.type)}</Fragment>
        )}

        <div
          className={classNames(
            'tw-flex tw-justify-center tw-flex-col',
            isDataset ? 'asset-card-text tw-pl-1' : 'tw-pl-2'
          )}
          data-testid="data-container">
          {isDataset ? (
            <Fragment>{getDatasetTitle(item.type, item.fqn)}</Fragment>
          ) : (
            <Fragment>
              <span
                className={classNames(
                  'tw-font-normal',
                  isActionVisible ? 'tw-w-32' : 'tw-w-52',
                  {
                    'tw-cursor-pointer hover:tw-underline':
                      Boolean(onTitleClick),
                  }
                )}
                title={item.displayName}
                onClick={() => {
                  onTitleClick?.(item.fqn);
                }}>
                <Ellipses tooltip>{item.displayName}</Ellipses>
              </span>
              {item.name && item.name !== item.displayName && (
                <span
                  className={classNames(
                    isActionVisible ? 'tw-w-32' : 'tw-w-52'
                  )}
                  title={isIconVisible ? item.name : capitalize(item.name)}>
                  <Ellipses tooltip>
                    {isIconVisible ? item.name : capitalize(item.name)}
                  </Ellipses>
                </span>
              )}
            </Fragment>
          )}
        </div>
      </div>
      {isActionVisible &&
        (isCheckBoxes ? (
          <input
            className="tw-p-1 custom-checkbox tw-self-center"
            data-testid="checkboxAddUser"
            type="checkbox"
            onChange={() => {
              onSelect?.(item.id as string);
            }}
          />
        ) : (
          <div className="tw-flex-none">
            <NonAdminAction
              html={<>You do not have permission to update the team.</>}
              isOwner={isOwner}
              permission={Operation.EditUsers}
              position="bottom">
              <span
                className={classNames('tw-h-8 tw-rounded tw-mb-3', {
                  'tw-opacity-40':
                    !isAdminUser &&
                    !isAuthDisabled &&
                    !isOwner &&
                    !userPermissions[Operation.EditUsers],
                })}
                data-testid="remove"
                onClick={() => onRemove?.(item.id as string)}>
                <FontAwesomeIcon
                  className="tw-cursor-pointer tw-opacity-0 group-hover:tw-opacity-100"
                  icon="remove"
                />
              </span>
            </NonAdminAction>
          </div>
        ))}
    </div>
  );
};

export default UserCard;
