import classNames from 'classnames';
import { toString } from 'lodash';
import React from 'react';
import { EntityHistory } from '../../generated/type/entityHistory';
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
    const list = versionList.versions?.slice(1) || [];

    return list.map((v, i) => {
      const currV = JSON.parse(v);

      return (
        <div
          className="timeline-content tw-py-2 tw-cursor-pointer"
          key={i}
          onClick={() => versionHandler(toString(currV?.version))}>
          <div className="timeline-wrapper">
            <span
              className={classNames('timeline-rounder', {
                selected: toString(currV?.version) === currentVersion,
              })}
            />
            <span className="timeline-line" />
            {list.length === i + 1 ? (
              <>
                <span className="timeline-line" />
                <span className="timeline-line" />
              </>
            ) : null}
          </div>
          <div className="tw-grid tw-gap-0.5">
            <p
              className={classNames('tw-text-grey-body tw-font-normal', {
                'tw-text-primary-active':
                  toString(currV?.version) === currentVersion,
              })}>
              v{parseFloat(currV?.version).toFixed(1)}
            </p>
            <p className="tw-text-xs">
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

      <div className="tw-mt-2">{getVersionList()}</div>
    </div>
  );
};

export default EntityVersionTimeLine;
