/*
 *  Copyright 2025 Collate.
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

import { Button, Dropdown, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React, { ReactNode, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ReactComponent as IconTeamsGrey } from '../../../assets/svg/teams-grey.svg';
import { EntityReference } from '../../../generated/entity/type';
import { getEntityName } from '../../../utils/EntityUtils';
import { getOwnerPath } from '../../../utils/ownerUtils';
import { AvatarSize } from '../OwnerLabel/OwnerLabel.interface';
import { AVATAR_SIZE_CLASS_MAP } from '../OwnerUserTeamList/OwnerUserTeamList.constants';

export interface OwnerTeamListProps {
  owners: EntityReference[];
  avatarSize: AvatarSize;
  ownerDisplayName?: Map<string, ReactNode>;
  placement?: 'vertical' | 'horizontal';
}

export const OwnerTeamList: React.FC<OwnerTeamListProps> = ({
  owners,
  avatarSize,
  ownerDisplayName,
  placement,
}) => {
  const { visibleTeam, remainingTeam } = useMemo(() => {
    return {
      visibleTeam: owners[0],
      remainingTeam: owners.slice(1),
    };
  }, [owners]);

  return (
    <div className="tw:flex tw:items-center tw:relative">
      <Link
        className="tw:flex tw:items-center tw:gap-2 tw:cursor-pointer tw:no-underline"
        data-testid="owner-link"
        to={getOwnerPath(visibleTeam)}>
        <IconTeamsGrey
          className={classNames(
            'tw:text-gray-700',
            AVATAR_SIZE_CLASS_MAP[avatarSize]
          )}
        />

        <div
          className={classNames({
            'tw:max-w-30': placement === 'vertical' || owners.length < 2,
            'tw:max-w-16': placement !== 'vertical' && owners.length >= 2,
          })}>
          <Typography
            ellipsis
            as="p"
            data-testid={getEntityName(visibleTeam)}
            size="text-xs"
            weight="medium">
            {ownerDisplayName?.get(visibleTeam.name ?? '') ??
              getEntityName(visibleTeam)}
          </Typography>
        </div>
      </Link>

      {owners.length > 1 && (
        <Dropdown.Root>
          <Button
            className="tw:ml-2 tw:text-xs tw:min-w-0 tw:p-0"
            color="link-color"
            size="sm">
            {`+${owners.length - 1}`}
          </Button>
          <Dropdown.Popover placement="bottom start">
            <Dropdown.Menu aria-label="remaining team owners">
              {remainingTeam.map((owner) => {
                const entityName = getEntityName(owner);
                const name =
                  ownerDisplayName?.get(owner.name ?? '') ?? entityName;

                return (
                  <Dropdown.Item key={owner.id} textValue={entityName}>
                    <Link
                      className="tw:max-w-46"
                      data-testid="owner-link"
                      to={getOwnerPath(owner)}>
                      <Typography ellipsis as="p" data-test={entityName}>
                        {name}
                      </Typography>
                    </Link>
                  </Dropdown.Item>
                );
              })}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      )}
    </div>
  );
};
