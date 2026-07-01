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
import { Avatar, Button, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  Popover as AriaPopover,
} from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as TeamsIcon } from '../../../assets/svg/ic-teams.svg';
import { OwnerType } from '../../../enums/user.enum';
import { EntityReference } from '../../../generated/entity/type';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getOwnerPath } from '../../../utils/ownerUtils';
import {
  AVATAR_FONT_SIZE_MAP,
  AVATAR_SIZE_NAME_MAP,
} from '../OwnerUserTeamList/OwnerUserTeamList.constants';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import { OwnerStackOverflowProps } from './OwnerAvatarStack.interface';

const POPOVER_AVATAR_SIZE = '24';
const OPEN_DELAY_MS = 100;
const CLOSE_DELAY_MS = 150;

export const OwnerStackOverflow: React.FC<OwnerStackOverflowProps> = ({
  owners,
  hiddenCount,
  avatarSize,
  ownerDisplayName,
}) => {
  const { t } = useTranslation();
  const remainingCountLabel = `+${hiddenCount}`;
  const fontSizeClass = AVATAR_FONT_SIZE_MAP[avatarSize];

  const [isOpen, setIsOpen] = useState(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = undefined;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }
  }, []);

  const scheduleOpen = useCallback(() => {
    clearTimers();
    openTimerRef.current = setTimeout(() => setIsOpen(true), OPEN_DELAY_MS);
  }, [clearTimers]);

  const scheduleClose = useCallback(() => {
    clearTimers();
    closeTimerRef.current = setTimeout(() => setIsOpen(false), CLOSE_DELAY_MS);
  }, [clearTimers]);

  const { teamOwners, userOwners } = useMemo(() => {
    const teams = owners.filter((owner) => owner.type === OwnerType.TEAM);
    const users = owners.filter((owner) => owner.type === OwnerType.USER);

    return {
      teamOwners: teams,
      userOwners: users,
    };
  }, [owners]);

  const renderOwnerRow = (owner: EntityReference) => {
    const entityName = getEntityName(owner);
    const displayName = ownerDisplayName?.get(owner.name ?? '') ?? entityName;
    const isTeam = owner.type === OwnerType.TEAM;

    return (
      <Link
        className="tw:flex tw:items-center tw:gap-2 tw:px-3 tw:py-1.5 tw:no-underline tw:text-secondary tw:hover:bg-secondary tw:hover:text-primary tw:rounded-md"
        data-testid={`overflow-owner-${entityName}`}
        key={owner.id}
        to={getOwnerPath(owner)}>
        {isTeam ? (
          <span className="tw:inline-flex tw:items-center tw:justify-center tw:shrink-0 tw:w-6 tw:h-6 tw:rounded-full tw:bg-brand-100 tw:text-brand-600">
            <TeamsIcon className="tw:w-3.5 tw:h-3.5" />
          </span>
        ) : (
          <span className="tw:inline-flex tw:items-center tw:justify-center tw:shrink-0">
            <ProfilePicture
              displayName={entityName}
              name={owner.name ?? ''}
              type="circle"
              width={POPOVER_AVATAR_SIZE}
            />
          </span>
        )}
        <Typography
          ellipsis
          as="span"
          className="tw:flex-1 tw:min-w-0"
          size="text-sm">
          {displayName}
        </Typography>
      </Link>
    );
  };

  return (
    <AriaDialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        aria-label={t('label.view-entity', {
          entity: t('label.owner-plural'),
        })}
        className="owner-stack-overflow-trigger"
        color="link-color"
        data-testid="owners-overflow-trigger"
        size="xs"
        onBlur={scheduleClose}
        onFocus={() => setIsOpen(true)}
        onHoverEnd={scheduleClose}
        onHoverStart={scheduleOpen}>
        <Avatar
          className={classNames(
            'tw:bg-brand-50 tw:ring-2 tw:ring-primary tw:text-brand-700 tw:font-medium',
            fontSizeClass
          )}
          placeholder={remainingCountLabel}
          size={AVATAR_SIZE_NAME_MAP[avatarSize]}
        />
      </Button>
      <AriaPopover
        className={({ isEntering, isExiting }) =>
          classNames(
            'tw:z-50 tw:w-72 tw:rounded-xl tw:bg-primary tw:shadow-lg tw:ring-1 tw:ring-secondary_alt tw:outline-hidden tw:will-change-transform',
            isEntering &&
              'tw:duration-150 tw:ease-out tw:animate-in tw:fade-in tw:placement-bottom:slide-in-from-top-1 tw:placement-top:slide-in-from-bottom-1',
            isExiting &&
              'tw:duration-100 tw:ease-in tw:animate-out tw:fade-out tw:placement-bottom:slide-out-to-top-1 tw:placement-top:slide-out-to-bottom-1'
          )
        }
        offset={6}
        placement="bottom start">
        <AriaDialog
          aria-label={t('label.owner-plural')}
          className="tw:outline-hidden"
          onMouseEnter={clearTimers}
          onMouseLeave={scheduleClose}>
          <div
            className="tw:flex tw:flex-col tw:py-2"
            data-testid="owners-overflow-popover">
            {teamOwners.length > 0 && (
              <div
                className="tw:flex tw:flex-col"
                data-testid="owners-overflow-teams-section">
                <Typography
                  as="div"
                  className="tw:px-3 tw:pt-1 tw:pb-2 tw:text-quaternary tw:uppercase tw:tracking-wider"
                  size="text-xs"
                  weight="medium">
                  {t('label.team-plural')} ({teamOwners.length})
                </Typography>
                {teamOwners.map(renderOwnerRow)}
              </div>
            )}

            {userOwners.length > 0 && (
              <div
                className="tw:flex tw:flex-col"
                data-testid="owners-overflow-users-section">
                <Typography
                  as="div"
                  className="tw:px-3 tw:pt-1 tw:pb-2 tw:text-quaternary tw:uppercase tw:tracking-wider"
                  size="text-xs"
                  weight="medium">
                  {t('label.user-plural')} ({userOwners.length})
                </Typography>
                {userOwners.map(renderOwnerRow)}
              </div>
            )}
          </div>
        </AriaDialog>
      </AriaPopover>
    </AriaDialogTrigger>
  );
};
