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
import {
  Box,
  Button,
  Divider,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLimitStore } from '../../../context/LimitsProvider/useLimitsStore';
import { EntityHistory } from '../../../generated/type/entityHistory';
import { renderVersionButton } from '../../../utils/EntityVersionUtils';
import CloseIcon from '../../Modals/CloseIcon.component';
import './entity-version-timeline.less';
import { EntityVersionTimelineProps } from './EntityVersionTimeline.interface';

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
            <Tooltip
              excludeTriggerFromTabOrder
              title={`+${hiddenVersions.length} more versions`}
              triggerClassName="tw:block">
              <div className="version-hidden">
                {hiddenVersions.map((v) =>
                  renderVersionButton(v, currentVersion, versionHandler)
                )}
              </div>
            </Tooltip>
            <div className="version-pricing-reached">
              <Typography as="h4" className="font-medium">
                {t('message.unlock-all-version-history')}
              </Typography>
              <Typography className="font-normal" color="secondary">
                {t('message.upgrade-to-paid-plan-for-version-history')}
              </Typography>

              <Button
                className="m-t-lg tw:w-full"
                color="primary"
                href="/settings/billing/plans">
                {t('label.see-upgrade-option-plural')}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    );
  }, [versionList, currentVersion, versionHandler]);

  return (
    <aside
      aria-label={t('label.version-plural-history')}
      className="versions-list-container"
      data-testid="versions-list-container"
      role="dialog">
      <div className="versions-list-header">
        <Box align="center" className="p-b-xss" justify="between">
          <Typography className="font-medium tw:text-primary">
            {t('label.version-plural-history')}
          </Typography>
          <CloseIcon handleCancel={onBack} />
        </Box>
        <Divider className="m-0" />
      </div>
      <div className="versions-list-body">{versions}</div>
    </aside>
  );
};

export default EntityVersionTimeLine;
