import classNames from 'classnames';
import React from 'react';
import { getEntityIcon } from '../../../utils/TableUtils';
import Tags from '../../tags/tags';
import { SelectedNode } from '../EntityLineage.interface';
import './LineageDrawer.style.css';

const getDataLabel = (v = '', separator = '.') => {
  const length = v.split(separator).length;

  return (
    <span
      className="tw-break-words description-text tw-self-center link-text tw-font-normal"
      data-testid="lineage-entity">
      {v.split(separator)[length - 1]}
    </span>
  );
};

const data = [
  {
    name: 'Service',
    value: 'bigquery',
    isLink: true,
  },
  {
    name: 'Database',
    value: 'shopify',
    isLink: true,
  },
  {
    name: 'Owner',
    value: 'Data Platform',
    isLink: true,
  },
  {
    name: 'Tier',
    value: 'Tier1',
    isLink: false,
  },
  {
    name: 'Usage',
    value: 'Low - 0th pctile',
    isLink: false,
  },
  {
    name: 'Queries',
    value: '0 past week',
    isLink: false,
  },
  {
    name: 'Rows',
    value: 1909,
    isLink: false,
  },
  {
    name: 'Columns',
    value: 10,
    isLink: false,
  },
  {
    name: '',
    value: '+1749 rows in last 6 days',
    isLink: false,
  },
];
const tags = ['Tier1', 'bigquery', 'shopify', 'user.address', 'user.phone'];

const LineageDrawer = ({
  show,
  onCancel,
  selectedNode,
}: {
  show: boolean;
  onCancel: (value: boolean) => void;
  selectedNode: SelectedNode;
}) => {
  return (
    <div className={classNames('side-drawer', { open: show })}>
      <header className="tw-flex tw-justify-between">
        <p className="tw-flex">
          <span className="tw-mr-2">{getEntityIcon(selectedNode.type)}</span>
          {getDataLabel(selectedNode.name)}
        </p>
        <div className="tw-flex">
          <svg
            className="tw-w-5 tw-h-5 tw-ml-1 tw-cursor-pointer"
            data-testid="closeDrawer"
            fill="none"
            stroke="#6B7280"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            onClick={() => onCancel(false)}>
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
      <section className="tw-mt-1">
        <span className="tw-text-grey-muted">Overview</span>
        <div className="tw-flex tw-flex-col">
          {data.map((d) => {
            return (
              <p className="tw-py-1.5" key={d.name}>
                {d.name && <span>{d.name}:</span>}
                <span
                  className={classNames(
                    { 'tw-ml-2': d.name },
                    {
                      'link-text': d.isLink,
                    }
                  )}>
                  {d.value}
                </span>
              </p>
            );
          })}
        </div>
      </section>
      <hr className="tw-mt-3 tw-border-primary-hover-lite" />
      <section className="tw-mt-1">
        <span className="tw-text-grey-muted">Tags</span>
        <div className="tw-flex tw-flex-wrap tw-pt-1.5">
          {tags.map((t) => {
            return <Tags key={t} tag={`#${t}`} />;
          })}
        </div>
      </section>
      <hr className="tw-mt-3 tw-border-primary-hover-lite" />
      <section className="tw-mt-1">
        <span className="tw-text-grey-muted">Description</span>
        <div>
          The dimension table contains data about your customers. The customers
          table contains one row per customer. It includes historical metrics
          (such as the total amount that each customer has spent in your store)
          as well as forward-looking metrics.
        </div>
      </section>
    </div>
  );
};

export default LineageDrawer;
