import { observer } from 'mobx-react';
import React, { FunctionComponent, useEffect, useState } from 'react';
import AppState from '../../AppState';
import SVGIcons, { Icons } from '../../utils/SvgUtils';

type Props = {
  countServices: number;
  countAssets: number;
};

const LANDING_STATES = [
  {
    title: 'Explore Assets',
    description:
      'OpenMetadata has {countAssets} Assets. Click Explore on top menu to search, claim or follow your Data Assets',
  },
  {
    title: 'Register Services',
    description:
      'Create a service to bring in metadata. Click Settings -> Services to explore available services.',
  },
  {
    title: 'Knowledgebase',
    description:
      'Donec tempus eu dolor non vehicula. Etiam malesuada, sapien ac euismod condimentum.',
  },
];

const MyDataHeader: FunctionComponent<Props> = ({
  countAssets,
  countServices,
}: Props) => {
  const { users, userTeams } = AppState;
  const [dataSummary, setdataSummary] = useState({
    asstes: {
      icon: Icons.ASSETS,
      data: `${countAssets} of Assets`,
    },
    service: {
      icon: Icons.SERVICE,
      data: `${countServices} of Services`,
    },
    user: {
      icon: Icons.USERS,
      data: `${users.length} of Users`,
    },
    terms: {
      icon: Icons.TERMS,
      data: `${userTeams.length} of Teams`,
    },
  });

  const getFormattedDescription = (description: string) => {
    return description.replaceAll('{countAssets}', countAssets.toString());
  };

  useEffect(() => {
    setdataSummary({
      asstes: {
        icon: Icons.ASSETS,
        data: `${countAssets} of Assets`,
      },
      service: {
        icon: Icons.SERVICE,
        data: `${countServices} of Services`,
      },
      user: {
        icon: Icons.USERS,
        data: `${users.length} of Users`,
      },
      terms: {
        icon: Icons.TERMS,
        data: `${userTeams.length} of Teams`,
      },
    });
  }, [userTeams, users, countAssets, countServices]);

  return (
    <section className="tw-flex tw-flex-col tw-items-center tw-py-7">
      <h3 className="tw-mb-3 tw-font-semibold">
        <span style={{ color: '#8D6AF1' }}>Open</span>
        <span style={{ color: '#7147E8' }}>Metadata</span>
      </h3>
      <div className="tw-flex tw-gap-5 tw-mb-7">
        {Object.values(dataSummary).map((data, index) => (
          <div className="tw-flex tw-items-center tw-gap-2" key={index}>
            <SVGIcons alt="icon" className="tw-h-4 tw-w-4" icon={data.icon} />

            <p className="tw-font-medium">{data.data}</p>
          </div>
        ))}
      </div>
      <div className="tw-flex tw-gap-10">
        {LANDING_STATES.map((d, i) => (
          <div className="tw-card tw-p-3 tw-w-72" key={i}>
            <p className="tw-font-medium tw-mb-1">{d.title}</p>
            <p>{getFormattedDescription(d.description)}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default observer(MyDataHeader);
