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
import { Typography } from 'antd';
import classNames from 'classnames';
import { toString } from 'lodash';
import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { getUserPath } from '../../../utils/RouterUtils';
import UserPopOverCard from '../../common/PopOverCard/UserPopOverCard';
import { EntityVersionButtonProps } from './EntityVersionTimeline.interface';

export const VersionButton = forwardRef<
  HTMLDivElement,
  EntityVersionButtonProps
>(
  (
    { version, onVersionSelect, selected, isMajorVersion, className, summary },
    ref
  ) => {
    const { t } = useTranslation();

    const { updatedBy, version: versionNumber, updatedAt } = version;
    const [, , user] = useUserProfile({
      permission: true,
      name: updatedBy,
    });

    const versionText = `v${parseFloat(versionNumber).toFixed(1)}`;

    return (
      <div
        className={classNames(
          'timeline-content p-b-md cursor-pointer',
          className
        )}
        data-testid={`version-entry-${versionText}`}
        ref={ref}
        onClick={() => onVersionSelect(toString(versionNumber))}>
        <div className="timeline-wrapper">
          <span
            className={classNames(
              'timeline-rounder',
              {
                selected,
              },
              {
                major: isMajorVersion,
              }
            )}
            data-testid={`version-selector-${versionText}`}
          />
          <span className={classNames('timeline-line')} />
        </div>
        <div>
          <Typography.Text
            className={classNames('d-flex font-medium', {
              'text-primary': selected,
            })}>
            <span>{versionText}</span>
            {isMajorVersion ? (
              <span
                className="m-l-xs text-xs font-medium text-grey-body tw-bg-tag p-x-xs p-y-xss bg-grey rounded-4"
                style={{ backgroundColor: '#EEEAF8' }}>
                {t('label.major')}
              </span>
            ) : null}
          </Typography.Text>
          <div
            className={classNames('text-xs font-normal break-all', {
              'diff-description': selected,
            })}
            data-testid="version-change-description">
            {summary}
          </div>
          <div className="text-xs d-flex gap-1 items-center flex-wrap">
            <UserPopOverCard
              className="font-italic"
              profileWidth={16}
              userName={updatedBy}>
              <Link
                className="thread-author m-r-xss"
                to={getUserPath(updatedBy)}>
                {getEntityName(user)}
              </Link>
            </UserPopOverCard>
            <span className="font-medium font-italic version-timestamp">
              {formatDateTime(updatedAt)}
            </span>
          </div>
        </div>
      </div>
    );
  }
);
