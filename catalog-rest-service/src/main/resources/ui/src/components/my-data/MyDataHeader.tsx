import classNames from 'classnames';
import { observer } from 'mobx-react';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import AppState from '../../AppState';
import { ROUTES } from '../../constants/constants';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

type Props = {
  countServices: number;
  countAssets: number;
  entityCounts: {
    tableCount: number;
    topicCount: number;
    dashboardCount: number;
  };
};
type Summary = {
  icon: string;
  data: string;
  link?: string;
};

const LANDING_STATES = [
  {
    title: 'Explore Assets',
    description:
      'OpenMetadata has {countAssets} Assets. Click Explore on top menu to search, claim or follow your Data Assets',
    route: ROUTES.EXPLORE,
  },
  {
    title: 'Register Services',
    description:
      'Create a service to bring in metadata. Click Settings -> Services to explore available services.',
    route: ROUTES.SERVICES,
  },
];

const MyDataHeader: FunctionComponent<Props> = ({
  countAssets,
  countServices,
  entityCounts,
}: Props) => {
  const history = useHistory();
  const { users, userTeams } = AppState;
  const [dataSummary, setdataSummary] = useState<Record<string, Summary>>({});

  const getFormattedDescription = (description: string) => {
    return description.replaceAll('{countAssets}', countAssets.toString());
  };

  const getSummarydata = () => {
    return {
      tables: {
        icon: Icons.TABLE_GREY,
        data: `${entityCounts.tableCount} Tables`,
        link: `/explore/tables`,
      },
      topics: {
        icon: Icons.TOPIC_GREY,
        data: `${entityCounts.topicCount} Topics`,
        link: `/explore/topics`,
      },
      dashboards: {
        icon: Icons.DASHBOARD_GREY,
        data: `${entityCounts.dashboardCount} Dashboards`,
        link: `/explore/dashboards`,
      },
      service: {
        icon: Icons.SERVICE,
        data: `${countServices} of Services`,
        link: `/services`,
      },
      user: {
        icon: Icons.USERS,
        data: `${users.length} of Users`,
        link: `/teams`,
      },
      terms: {
        icon: Icons.TERMS,
        data: `${userTeams.length} of Teams`,
        link: `/teams`,
      },
    };
  };

  const handleRouting = (url = '') => {
    if (url) {
      history.push(url);
    }
  };

  useEffect(() => {
    setdataSummary(getSummarydata());
  }, [userTeams, users, countServices]);

  return (
    <section className="tw-flex tw-flex-col tw-items-center tw-py-7">
      <h3 className="tw-mb-7 tw-font-semibold ">
        <span className="tw-text-primary-II">Open</span>
        <span className="tw-text-primary">Metadata</span>
      </h3>
      <div className="tw-flex tw-mb-7">
        {Object.values(dataSummary).map((data, index) => (
          <div
            className={classNames('tw-flex tw-items-center', {
              'tw-pl-5': Boolean(index),
            })}
            key={index}>
            <SVGIcons alt="icon" className="tw-h-4 tw-w-4" icon={data.icon} />
            {data.link ? (
              <Link className="tw-font-medium tw-pl-2" to={data.link}>
                <button className="tw-text-grey-body hover:tw-text-primary-hover hover:tw-underline">
                  {data.data}
                </button>
              </Link>
            ) : (
              <p className="tw-font-medium tw-pl-2">{data.data}</p>
            )}
          </div>
        ))}
      </div>

      <div className="tw-flex">
        {LANDING_STATES.map((d, i) => (
          <div
            className={classNames(
              'tw-card tw-p-3 tw-w-72 tw-mr-10',
              d.route ? 'tw-cursor-pointer' : null
            )}
            key={i}
            onClick={() => handleRouting(d.route)}>
            <p className="tw-font-medium tw-mb-1">{d.title}</p>
            <p>{getFormattedDescription(d.description)}</p>
          </div>
        ))}
        <div className="tw-card tw-p-3 tw-w-72">
          <p className="tw-font-medium tw-mb-1">Knowledgebase</p>
          <p>
            Check our{' '}
            <a
              className="link-text"
              href="https://docs.open-metadata.org/"
              rel="noopener noreferrer"
              target="_blank">
              docs
            </a>{' '}
            for documentation and try out the{' '}
            <span
              className="link-text"
              onClick={() => handleRouting(ROUTES.SWAGGER)}>
              APIs
            </span>{' '}
            here.
          </p>
        </div>
      </div>
    </section>
  );
};

export default observer(MyDataHeader);
