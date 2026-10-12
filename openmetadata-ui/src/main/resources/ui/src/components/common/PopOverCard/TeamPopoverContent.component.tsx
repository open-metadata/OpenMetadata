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

import { isEmpty } from 'lodash';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as IconTeams } from '../../../assets/svg/teams-grey.svg';
import { OwnerType } from '../../../enums/user.enum';
import { Team } from '../../../generated/entity/teams/team';
import { useEntityPopoverData } from '../../../hooks/popover/useEntityPopoverData';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getTeamAndUserDetailsPath } from '../../../utils/RouterUtils';
import Loader from '../Loader/Loader';
import RichTextEditorPreviewerNew from '../RichTextEditor/RichTextEditorPreviewNew';
import { TeamPopoverContentProps } from './UserPopOverCard.interface';

export const TeamPopoverContent = React.memo(
  ({ teamName }: TeamPopoverContentProps) => {
    const { t } = useTranslation();
    const { data, loading } = useEntityPopoverData(teamName, OwnerType.TEAM);
    const team = data as Team | undefined;

    if (loading) {
      return <Loader size="small" />;
    }

    if (isEmpty(team)) {
      return (
        <div className="w-40">
          <span>{t('message.no-data-available')}</span>
        </div>
      );
    }

    return (
      <div className="w-40" data-testid="team-popover-content">
        {team?.description ? (
          <RichTextEditorPreviewerNew
            enableSeeMoreVariant={false}
            markdown={team.description}
          />
        ) : (
          <span className="text-grey-muted">{t('label.no-description')}</span>
        )}

        <p className="d-flex flex-wrap m-t-xs">
          {team?.teamType && (
            <span
              className="bg-grey rounded-4 p-x-xs text-grey-body text-xs m-b-xss m-r-xss"
              data-testid="team-type">
              {team.teamType}
            </span>
          )}
          <span
            className="bg-grey rounded-4 p-x-xs text-grey-body text-xs m-b-xss"
            data-testid="team-user-count">
            {`${team?.userCount ?? 0} ${t(
              team?.userCount === 1 ? 'label.user' : 'label.user-plural'
            )}`}
          </span>
        </p>

        {!isEmpty(team?.parents) && (
          <div className="m-t-xs" data-testid="team-parents">
            <p className="d-flex items-center">
              <IconTeams height={16} width={16} />
              <span className="m-r-xs m-l-xss align-middle font-medium">
                {t('label.parent')}
              </span>
            </p>

            <p className="d-flex flex-wrap m-t-xss">
              {team?.parents?.map((parent) => (
                <Link
                  className="bg-grey rounded-4 p-x-xs text-grey-body text-xs m-b-xss m-r-xss"
                  key={parent.id}
                  to={getTeamAndUserDetailsPath(parent.name ?? '')}>
                  {getEntityName(parent)}
                </Link>
              ))}
            </p>
          </div>
        )}
      </div>
    );
  }
);
