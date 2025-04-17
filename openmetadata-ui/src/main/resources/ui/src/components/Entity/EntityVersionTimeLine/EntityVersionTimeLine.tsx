/* eslint-disable i18next/no-literal-string */
/*
 *  Copyright 2022 Collate.
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

import { Button, Col, Divider, Drawer, Row, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty, toString } from 'lodash';
import { forwardRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { EntityHistory } from '../../../generated/type/entityHistory';
import { useUserProfile } from '../../../hooks/user-profile/useUserProfile';
import { formatDateTime } from '../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import {
  getSummary,
  renderVersionButton,
} from '../../../utils/EntityVersionUtils';
import { getUserPath } from '../../../utils/RouterUtils';
import UserPopOverCard from '../../common/PopOverCard/UserPopOverCard';
import CloseIcon from '../../Modals/CloseIcon.component';
import './entity-version-timeline.less';
import {
  EntityVersionButtonProps,
  EntityVersionTimelineProps,
} from './EntityVersionTimeline.interface';

export const VersionButton = forwardRef<
  HTMLDivElement,
  EntityVersionButtonProps
>(({ version, onVersionSelect, selected, isMajorVersion, className }, ref) => {
  const { t } = useTranslation();

  const {
    updatedBy,
    version: versionNumber,
    changeDescription,
    updatedAt,
    glossary,
  } = version;
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
          })}>
          {getSummary({
            changeDescription: changeDescription,
            isGlossaryTerm: !isEmpty(glossary),
          })}
        </div>
        <div className="text-xs d-flex gap-1 items-center flex-wrap">
          <UserPopOverCard
            className="font-italic"
            profileWidth={16}
            userName={updatedBy}>
            <Link className="thread-author m-r-xss" to={getUserPath(updatedBy)}>
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
});

const EntityVersionTimeLine: React.FC<EntityVersionTimelineProps> = ({
  versionList = {} as EntityHistory,
  currentVersion,
  versionHandler,
  onBack,
  entityType,
}) => {
  const { t } = useTranslation();

  const { resourceLimit, getResourceLimit } = useLimitStore();

  useEffect(() => {
    entityType && getResourceLimit(entityType);
  }, [entityType]);

  const { configuredLimit: { maxVersions } = { maxVersions: -1 } } =
    resourceLimit[entityType ?? ''] ?? {};

  const versions = useMemo(() => {
    const maxAllowed = maxVersions ?? -1;
    let versions = versionList.versions ?? [];

    let hiddenVersions = [];

    if (maxAllowed > 0) {
      versions = versionList.versions?.slice(0, maxAllowed) ?? [];
      hiddenVersions = versionList.versions?.slice(maxAllowed) ?? [];
    }

    return (
      <div className="relative h-full">
        {versions.length ? (
          <div className="timeline-content cursor-pointer">
            <div className="timeline-wrapper">
              <span className="timeline-line-se" />
            </div>
          </div>
        ) : null}

        {versions?.map((v) => {
          return renderVersionButton(v, currentVersion, versionHandler);
        })}
        {hiddenVersions?.length > 0 ? (
          <>
            <Tooltip title={`+${hiddenVersions.length} more versions`}>
              <div className="version-hidden">
                {hiddenVersions.map((v) =>
                  renderVersionButton(v, currentVersion, versionHandler)
                )}
              </div>
            </Tooltip>
            <div className="version-pricing-reached">
              <Typography.Title className="font-medium" level={4}>
                Unlock all of your version history
              </Typography.Title>
              <Typography.Text className="text-grey-muted font-normal">
                Upgrade to paid plan for access to all of your version history.
              </Typography.Text>

              <Button
                block
                className="m-t-lg"
                href="/settings/billing/plans"
                type="primary">
                See Upgrade Options
              </Button>
            </div>
          </>
        ) : null}
      </div>
    );
  }, [versionList, currentVersion, versionHandler]);

  return (
    <Drawer
      destroyOnClose
      open
      className="versions-list-container"
      closable={false}
      getContainer={false}
      mask={false}
      maskClosable={false}
      title={
        <>
          <Row className="p-b-xss" justify="space-between">
            <Col>
              <Typography.Text className="font-medium">
                {t('label.version-plural-history')}
              </Typography.Text>
            </Col>
            <Col>
              <CloseIcon handleCancel={onBack} />
            </Col>
          </Row>
          <Divider className="m-0" />
        </>
      }
      width={330}>
      {versions}
    </Drawer>
  );
};

export default EntityVersionTimeLine;
