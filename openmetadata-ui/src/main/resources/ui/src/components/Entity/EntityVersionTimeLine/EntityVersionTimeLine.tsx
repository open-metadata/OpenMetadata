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

import { Divider, Typography } from 'antd';
import classNames from 'classnames';
import CloseIcon from 'components/Modals/CloseIcon.component';
import { EntityHistory } from 'generated/type/entityHistory';
import { capitalize, toString } from 'lodash';
import React, { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSummary, isMajorVersion } from 'utils/EntityVersionUtils';

type Props = {
  versionList: EntityHistory;
  currentVersion: string;
  show?: boolean;
  versionHandler: (v: string) => void;
  onBack: () => void;
};
type VersionType = 'all' | 'major' | 'minor';

const EntityVersionTimeLine: React.FC<Props> = ({
  versionList = {} as EntityHistory,
  currentVersion,
  show = false,
  versionHandler,
  onBack,
}: Props) => {
  const { t } = useTranslation();
  const [versionType] = useState<VersionType>('all');
  const getVersionList = () => {
    let versionTypeList = [];
    const list = versionList.versions ?? [];

    switch (versionType) {
      case 'major':
        versionTypeList = list.filter((v) => {
          const currV = JSON.parse(v);

          return isMajorVersion(
            parseFloat(currV?.changeDescription?.previousVersion)
              .toFixed(1)
              .toString(),
            parseFloat(currV?.version).toFixed(1).toString()
          );
        });

        break;
      case 'minor':
        versionTypeList = list.filter((v) => {
          const currV = JSON.parse(v);

          return !isMajorVersion(
            parseFloat(currV?.changeDescription?.previousVersion)
              .toFixed(1)
              .toString(),
            parseFloat(currV?.version).toFixed(1).toString()
          );
        });

        break;
      case 'all':
      default:
        versionTypeList = list;

        break;
    }

    return versionTypeList.length ? (
      versionTypeList.map((v, i) => {
        const currV = JSON.parse(v);
        const majorVersionChecks = () => {
          return (
            isMajorVersion(
              parseFloat(currV?.changeDescription?.previousVersion)
                .toFixed(1)
                .toString(),
              parseFloat(currV?.version).toFixed(1).toString()
            ) && versionType === 'all'
          );
        };

        return (
          <Fragment key={i}>
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
                  data-testid="select-version"
                />
                <span className={classNames('timeline-line')} />
              </div>
              <div>
                <Typography.Text
                  className={classNames('d-flex font-medium', {
                    'text-primary': toString(currV?.version) === currentVersion,
                  })}>
                  <span>{`v${parseFloat(currV?.version).toFixed(1)}`}</span>
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
                  {getSummary(currV?.changeDescription)}
                </div>
                <p className="text-xs font-italic">
                  <span className="font-medium">{currV?.updatedBy}</span>
                  <span className="text-grey-muted">
                    {' '}
                    {t('label.updated-on')}{' '}
                  </span>
                  <span className="font-medium">
                    {new Date(currV?.updatedAt).toLocaleDateString('en-CA', {
                      hour: 'numeric',
                      minute: 'numeric',
                    })}
                  </span>
                </p>
              </div>
            </div>
          </Fragment>
        );
      })
    ) : (
      <p className="text-grey-muted d-flex justify-center items-center">
        {t('message.no-version-type-available', {
          type: capitalize(versionType),
        })}
      </p>
    );
  };

  return (
    <div className={classNames('timeline-drawer', { open: show })}>
      <header className="d-flex justify-between">
        <p className="font-medium ">{t('label.version-plural-history')}</p>
        <CloseIcon handleCancel={onBack} />
      </header>
      <Divider className="m-t-sm m-b-md" />

      <div>{getVersionList()}</div>
    </div>
  );
};

export default EntityVersionTimeLine;
