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
      data-testid="versions-list-container"
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
