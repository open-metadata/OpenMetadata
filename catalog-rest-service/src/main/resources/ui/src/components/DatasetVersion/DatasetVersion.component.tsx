import classNames from 'classnames';
import React, { useState } from 'react';
import { getTeamDetailsPath } from '../../constants/constants';
import { ColumnJoins } from '../../generated/entity/data/table';
import { getPartialNameFromFQN } from '../../utils/CommonUtils';
import { getTableTags } from '../../utils/TagsUtils';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import TabsPane from '../common/TabsPane/TabsPane';
import PageContainer from '../containers/PageContainer';
import EntityVersionTimeLine from '../EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from '../Loader/Loader';
import SchemaTab from '../SchemaTab/SchemaTab.component';
import { DatasetVersionProp } from './DatasetVersion.interface';

const DatasetVersion: React.FC<DatasetVersionProp> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owner,
  tier,
  slashedTableName,
  datasetFQN,
  versionList,
  backHandler,
  versionHandler,
}: DatasetVersionProp) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(true);
  const versionDrawerHandler = () => {
    setIsDrawerOpen((prevState) => !prevState);
  };
  const extraInfo = [
    {
      key: 'Owner',
      value:
        owner?.type === 'team'
          ? getTeamDetailsPath(owner?.name || '')
          : owner?.name || '',
      placeholderText: owner?.displayName || '',
      isLink: owner?.type === 'team',
      openInNewTab: false,
    },
    { key: 'Tier', value: tier ? tier.split('.')[1] : '' },
  ];

  const tabs = [
    {
      name: 'Schema',
      icon: {
        alt: 'schema',
        name: 'icon-schema',
        title: 'Schema',
      },
      isProtected: false,
      position: 1,
    },
  ];

  return (
    <PageContainer>
      <div
        className={classNames(
          'tw-px-4 tw-w-full tw-h-full tw-flex tw-flex-col tw-relative'
        )}>
        {isVersionLoading ? (
          <Loader />
        ) : (
          <div className={classNames({ 'version-data': isDrawerOpen })}>
            <EntityPageInfo
              entityName={currentVersionData.name}
              extraInfo={extraInfo}
              followersList={[]}
              tags={getTableTags(currentVersionData.columns || [])}
              tier={tier || ''}
              titleLinks={slashedTableName}
              version={version}
              versionHandler={versionDrawerHandler}
            />
            <div className="tw-mt-1 tw-flex tw-flex-col tw-flex-grow ">
              <TabsPane activeTab={1} className="tw-flex-initial" tabs={tabs} />
              <div className="tw-bg-white tw-flex-grow">
                <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full tw-mt-4 ">
                  <div className="tw-col-span-full">
                    <Description
                      isReadOnly
                      description={currentVersionData.description || ''}
                    />
                  </div>

                  <div className="tw-col-span-full">
                    <SchemaTab
                      isReadOnly
                      columnName={getPartialNameFromFQN(
                        datasetFQN,
                        ['column'],
                        '.'
                      )}
                      columns={currentVersionData.columns}
                      joins={currentVersionData.joins as ColumnJoins[]}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <EntityVersionTimeLine
          currentVersion={version}
          show={isDrawerOpen}
          versionHandler={versionHandler}
          versionList={versionList}
          onBack={backHandler}
        />
      </div>
    </PageContainer>
  );
};

export default DatasetVersion;
