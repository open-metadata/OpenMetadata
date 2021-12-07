/*
 *  Copyright 2021 Collate
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

import classNames from 'classnames';
import { capitalize, toString } from 'lodash';
import React, { Fragment, useState } from 'react';
import { EntityHistory } from '../../generated/type/entityHistory';
import { getSummary, isMajorVersion } from '../../utils/EntityVersionUtils';

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
              <div className="timeline-content tw-cursor-pointer tw--mb-2.5">
                <div className="timeline-wrapper">
                  <span className="timeline-line-se" />
                </div>
              </div>
            ) : null}
            <div
              className="timeline-content tw-py-2 tw-cursor-pointer"
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
              <div className="tw-grid tw-gap-0.5">
                <p
                  className={classNames('tw-text-grey-body tw-font-normal', {
                    'tw-text-primary-active':
                      toString(currV?.version) === currentVersion,
                  })}>
                  <span>v{parseFloat(currV?.version).toFixed(1)}</span>
                  {majorVersionChecks() ? (
                    <span className="tw-ml-2 tw-text-xs tw-font-normal tw-text-grey-body tw-bg-tag tw-px-2 tw-py-0.5 tw-rounded">
                      Major
                    </span>
                  ) : null}
                </p>
                <div className="tw-text-xs tw-font-normal tw-break-all">
                  {getSummary(currV?.changeDescription)}
                </div>
                <p className="tw-text-xs tw-italic">
                  <span className="tw-font-normal">{currV?.updatedBy}</span>
                  <span className="tw-text-grey-muted"> updated on </span>
                  <span className="tw-font-normal">
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
      <p className="tw-text-grey-muted tw-flex tw-justify-center tw-items-center tw-mt-10">
        {`No ${capitalize(versionType)} versions available`}
      </p>
    );
  };

  return (
    <div className={classNames('timeline-drawer', { open: show })}>
      <header className="tw-flex tw-justify-between">
        <p className="tw-font-medium tw-mr-2">Versions History</p>
        <div className="tw-flex" onClick={onBack}>
          <svg
            className="tw-w-5 tw-h-5 tw-ml-1 tw-cursor-pointer"
            data-testid="closeDrawer"
            fill="none"
            stroke="#6B7280"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg">
            <path
              d="M6 18L18 6M6 6l12 12"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </div>
      </header>
      <hr className="tw-mt-3 tw-border-primary-hover-lite" />

      <div className="tw-my-2 tw-pb-9">{getVersionList()}</div>
    </div>
  );
};

export default EntityVersionTimeLine;
