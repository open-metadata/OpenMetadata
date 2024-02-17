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

import { Col, Divider, Drawer, Row, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty, toString } from 'lodash';
import React, { Fragment, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityHistory } from '../../../generated/type/entityHistory';
import { getSummary, isMajorVersion } from '../../../utils/EntityVersionUtils';
import UserPopOverCard from '../../common/PopOverCard/UserPopOverCard';
import CloseIcon from '../../Modals/CloseIcon.component';
import './entity-version-timeline.less';

type Props = {
  versionList: EntityHistory;
  currentVersion: string;
  versionHandler: (v: string) => void;
  onBack: () => void;
};

const EntityVersionTimeLine: React.FC<Props> = ({
  versionList = {} as EntityHistory,
  currentVersion,
  versionHandler,
  onBack,
}: Props) => {
  const { t } = useTranslation();

  const versions = useMemo(
    () =>
      versionList.versions.map((v, i) => {
        const currV = JSON.parse(v);

        const majorVersionChecks = () => {
          return isMajorVersion(
            parseFloat(currV?.changeDescription?.previousVersion)
              .toFixed(1)
              .toString(),
            parseFloat(currV?.version).toFixed(1).toString()
          );
        };
        const versionText = `v${parseFloat(currV?.version).toFixed(1)}`;

        return (
          <Fragment key={currV.version}>
            {i === 0 ? (
              <div className="timeline-content cursor-pointer">
                <div className="timeline-wrapper">
                  <span className="timeline-line-se" />
                </div>
              </div>
            ) : null}
            <div
              className="timeline-content p-b-md cursor-pointer"
              onClick={() => versionHandler(toString(currV?.version))}>
              <div className="timeline-wrapper">
                <span
                  className={classNames(
                    'timeline-rounder',
                    {
                      selected: toString(currV?.version) === currentVersion,
                    },
                    {
                      major: majorVersionChecks(),
                    }
                  )}
                  data-testid={`version-selector-${versionText}`}
                />
                <span className={classNames('timeline-line')} />
              </div>
              <div>
                <Typography.Text
                  className={classNames('d-flex font-medium', {
                    'text-primary': toString(currV?.version) === currentVersion,
                  })}>
                  <span>{versionText}</span>
                  {majorVersionChecks() ? (
                    <span
                      className="m-l-xs text-xs font-medium text-grey-body tw-bg-tag p-x-xs p-y-xss bg-grey rounded-4"
                      style={{ backgroundColor: '#EEEAF8' }}>
                      {t('label.major')}
                    </span>
                  ) : null}
                </Typography.Text>
                <div
                  className={classNames('text-xs font-normal break-all', {
                    'diff-description':
                      toString(currV?.version) === currentVersion,
                  })}>
                  {getSummary({
                    changeDescription: currV?.changeDescription,
                    isGlossaryTerm: !isEmpty(currV?.glossary),
                  })}
                </div>
                <div className="text-xs d-flex gap-1 items-center flex-wrap">
                  <UserPopOverCard
                    showUserName
                    className="font-italic"
                    profileWidth={16}
                    userName={currV?.updatedBy as string}
                  />
                  <span className="font-medium font-italic version-timestamp">
                    {new Date(currV?.updatedAt).toLocaleDateString('en-CA', {
                      hour: 'numeric',
                      minute: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </Fragment>
        );
      }),
    [versionList, currentVersion, versionHandler]
  );

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
