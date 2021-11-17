import classNames from 'classnames';
import { toString } from 'lodash';
import React, { Fragment } from 'react';
import { EntityHistory } from '../../generated/type/entityHistory';
import { getSummary } from '../../utils/EntityVersionUtils';
import './EntityVersionTimeLine.css';

type Props = {
  versionList: EntityHistory;
  currentVersion: string;
  show?: boolean;
  versionHandler: (v: string) => void;
  onBack: () => void;
};

const EntityVersionTimeLine: React.FC<Props> = ({
  versionList,
  currentVersion,
  show = false,
  versionHandler,
  onBack,
}: Props) => {
  const getVersionList = () => {
    const list = versionList.versions ?? [];

    return list.map((v, i) => {
      const currV = JSON.parse(v);

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
                className={classNames('timeline-rounder', {
                  selected: toString(currV?.version) === currentVersion,
                })}
                data-testid="select-version"
              />
              <span className="timeline-line" />
            </div>
            <div className="tw-grid tw-gap-0.5">
              <p
                className={classNames('tw-text-grey-body tw-font-normal', {
                  'tw-text-primary-active':
                    toString(currV?.version) === currentVersion,
                })}>
                v{parseFloat(currV?.version).toFixed(1)}
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
    });
  };

  return (
    <div className={classNames('timeline-drawer', { open: show })}>
      <header className="tw-flex tw-justify-between">
        <p className="tw-font-medium">Version history</p>
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
