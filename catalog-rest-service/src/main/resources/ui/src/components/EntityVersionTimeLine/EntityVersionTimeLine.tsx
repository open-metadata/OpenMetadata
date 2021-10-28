import React from 'react';
import { EntityHistory } from '../../generated/type/entityHistory';
import './EntityVersionTimeLine.css';

type Props = {
  versionList: EntityHistory;
};

const EntityVersionTimeLine = ({ versionList }: Props) => {
  return (
    <div className="timeline-drawer">
      <header className="tw-flex tw-justify-between">
        <p className="tw-flex">Version history</p>
        <div className="tw-flex">
          <svg
            className="tw-w-5 tw-h-5 tw-ml-1 tw-cursor-pointer"
            data-testid="closeDrawer"
            fill="none"
            stroke="#6B7280"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            // onClick={() => onCancel(false)}
          >
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
      <div className="tw-mt-2">
        {versionList.versions?.map((v, i) => (
          <div className="timeline-content tw-py-2" key={i}>
            <div className="timeline-wrapper">
              <span className="timeline-rounder" />
              <span className="timeline-line" />
            </div>
            <div className="tw-grid tw-gap-0.5">
              <h5 className="tw-text-grey-body tw-font-normal tw-text-sm tw-m-0">
                v{JSON.parse(v)?.version}
              </h5>
              <p>
                <span className="tw-font-medium">
                  {JSON.parse(v)?.updatedBy}
                </span>{' '}
                updated on{' '}
                <span className="tw-font-medium">
                  {new Date(JSON.parse(v)?.updatedAt).toLocaleDateString(
                    'en-CA',
                    {
                      hour: 'numeric',
                      minute: 'numeric',
                    }
                  )}
                </span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EntityVersionTimeLine;
