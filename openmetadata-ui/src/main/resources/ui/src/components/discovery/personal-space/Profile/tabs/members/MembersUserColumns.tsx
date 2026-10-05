/*
 *  Copyright 2026 Collate.
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
import {
  Box,
  Button,
  Popover,
  PopoverTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import type { EntityReference } from '../../../../../../generated/entity/type';
import type { User } from '../../../../../../generated/entity/teams/user';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { LIST_CAP } from '../../../../../../utils/PermissionsUtils';
import UserPopOverCard from '../../../../../common/PopOverCard/UserPopOverCard';
import ProfileHashLink from './ProfileHashLink';
import {
  profileHash,
  ProfileHashTarget,
  toHashLocation,
} from './profileHash.utils';

type GoTo = (target: ProfileHashTarget) => void;

// Username cell shared by the Users, Online-Users and Team-detail member tables —
// a UserPopOverCard that both links (href for new-tab) and navigates in-app.
export const UserNameCell: FC<{ record: User; goTo: GoTo }> = ({
  record,
  goTo,
}) =>
  record.name ? (
    <UserPopOverCard
      showUserName
      profileWidth={16}
      to={toHashLocation(profileHash.user(record.name))}
      userName={record.name}
      onTitleClick={() => goTo(profileHash.user(record.name ?? ''))}
    />
  ) : (
    <Typography size="text-sm">{getEntityName(record)}</Typography>
  );

// A list of entity-reference links (teams/roles) with a "+N more" popover past
// LIST_CAP — shared so every member table renders them identically.
export const EntityLinksCell: FC<{
  items?: EntityReference[];
  targetFn: (fqn: string) => ProfileHashTarget;
  goTo: GoTo;
  emptyLabel: string;
  testId?: string;
}> = ({ items = [], targetFn, goTo, emptyLabel, testId }) => {
  const { t } = useTranslation();

  if (items.length === 0) {
    return <>{emptyLabel}</>;
  }

  const renderItem = (item: EntityReference) => (
    <ProfileHashLink
      key={item.id}
      target={targetFn(item.fullyQualifiedName ?? item.name ?? '')}
      onNavigate={goTo}>
      {getEntityName(item)}
    </ProfileHashLink>
  );

  return (
    <Box
      align="center"
      data-testid={testId}
      direction="row"
      gap={1}
      wrap="wrap">
      {items.slice(0, LIST_CAP).map(renderItem)}
      {items.length > LIST_CAP && (
        <PopoverTrigger>
          <Button
            className="tw:py-0.5 tw:bg-tertiary"
            color="secondary"
            data-testid="plus-more-count"
            size="xs">
            {t('label.plus-count-more', { count: items.length - LIST_CAP })}
          </Button>
          <Popover className="tw:max-h-80! tw:overflow-scroll">
            <Box className="tw:p-3" direction="col" gap={1}>
              {items.slice(LIST_CAP).map(renderItem)}
            </Box>
          </Popover>
        </PopoverTrigger>
      )}
    </Box>
  );
};
