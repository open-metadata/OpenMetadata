import { isEqual } from 'lodash';
import React, { useEffect, useState } from 'react';
import { getTeamDetailsPath } from '../../constants/constants';
import { Dbtmodel } from '../../generated/entity/data/dbtmodel';
import { User } from '../../generated/entity/teams/user';
import { useAuth } from '../../hooks/authHooks';
import {
  getCurrentUserId,
  getPartialNameFromFQN,
  getUserTeams,
} from '../../utils/CommonUtils';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import TabsPane from '../common/TabsPane/TabsPane';
import PageContainer from '../containers/PageContainer';
import ManageTab from '../ManageTab/ManageTab.component';
import SchemaTab from '../SchemaTab/SchemaTab.component';
import { DBTModelDetailsProps } from './DBTModelDetails.interface';

const DBTModelDetails: React.FC<DBTModelDetailsProps> = ({
  dbtModelDetails,
  entityName,
  dbtModelFQN,
  activeTab,
  setActiveTabHandler,
  owner,
  description,
  columns,
  followDBTModelHandler,
  unfollowDBTModelHandler,
  followers,
  dbtModelTags,
  slashedDBTModelName,
  descriptionUpdateHandler,
  columnsUpdateHandler,
  settingsUpdateHandler,
  users,
  version,
}: DBTModelDetailsProps) => {
  const { isAuthDisabled } = useAuth();
  const [isEdit, setIsEdit] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);

  const hasEditAccess = () => {
    if (owner?.type === 'user') {
      return owner.id === getCurrentUserId();
    } else {
      return getUserTeams().some((team) => team.id === owner?.id);
    }
  };
  const setFollowersData = (followers: Array<User>) => {
    setIsFollowing(
      followers.some(({ id }: { id: string }) => id === getCurrentUserId())
    );
    setFollowersCount(followers?.length);
  };
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
    {
      name: 'View Definition',
      icon: {
        alt: 'view_definition',
        name: 'icon-profiler',
        title: 'View Definition',
      },
      isProtected: false,
      position: 2,
    },
    {
      name: 'Manage',
      icon: {
        alt: 'manage',
        name: 'icon-manage',
        title: 'Manage',
      },
      isProtected: true,
      protectedState: !owner || hasEditAccess(),
      position: 3,
    },
  ];

  const extraInfo: Array<{
    key?: string;
    value: string | number | React.ReactNode;
    isLink?: boolean;
    placeholderText?: string;
    openInNewTab?: boolean;
  }> = [
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
  ];

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };
  const onCancel = () => {
    setIsEdit(false);
  };

  const onDescriptionUpdate = (updatedHTML: string) => {
    if (description !== updatedHTML) {
      const updatedDBTModelDetails = {
        ...dbtModelDetails,
        description: updatedHTML,
      };
      descriptionUpdateHandler(updatedDBTModelDetails);
      setIsEdit(false);
    } else {
      setIsEdit(false);
    }
  };

  const onColumnsUpdate = (updateColumns: Dbtmodel['columns']) => {
    if (!isEqual(columns, updateColumns)) {
      const updatedDBTModelDetails = {
        ...dbtModelDetails,
        columns: updateColumns,
      };
      columnsUpdateHandler(updatedDBTModelDetails);
    }
  };

  const onSettingsUpdate = (newOwner?: Dbtmodel['owner']) => {
    if (newOwner) {
      const updatedDBTModelDetails = {
        ...dbtModelDetails,
        owner: newOwner
          ? {
              ...dbtModelDetails.owner,
              ...newOwner,
            }
          : dbtModelDetails.owner,
      };

      return settingsUpdateHandler(updatedDBTModelDetails);
    } else {
      return Promise.reject();
    }
  };

  const followDBTModel = () => {
    if (isFollowing) {
      setFollowersCount((preValu) => preValu - 1);
      setIsFollowing(false);
      unfollowDBTModelHandler();
    } else {
      setFollowersCount((preValu) => preValu + 1);
      setIsFollowing(true);
      followDBTModelHandler();
    }
  };

  useEffect(() => {
    if (isAuthDisabled && users.length && followers.length) {
      setFollowersData(followers);
    }
  }, [users, followers]);

  useEffect(() => {
    setFollowersData(followers);
  }, [followers]);

  return (
    <PageContainer>
      <div className="tw-px-4 tw-w-full tw-h-full tw-flex tw-flex-col">
        <EntityPageInfo
          entityName={entityName}
          extraInfo={extraInfo}
          followers={followersCount}
          followersList={followers}
          followHandler={followDBTModel}
          isFollowing={isFollowing}
          tags={dbtModelTags}
          tier=""
          titleLinks={slashedDBTModelName}
          version={version}
          versionHandler={() => {
            return;
          }}
        />

        <div className="tw-mt-1 tw-flex tw-flex-col tw-flex-grow">
          <TabsPane
            activeTab={activeTab}
            className="tw-flex-initial"
            setActiveTab={setActiveTabHandler}
            tabs={tabs}
          />

          <div className="tw-bg-white tw-flex-grow">
            {activeTab === 1 && (
              <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full tw-mt-4 ">
                <div className="tw-col-span-4">
                  <Description
                    description={description}
                    entityName={entityName}
                    hasEditAccess={hasEditAccess()}
                    isEdit={isEdit}
                    owner={owner}
                    onCancel={onCancel}
                    onDescriptionEdit={onDescriptionEdit}
                    onDescriptionUpdate={onDescriptionUpdate}
                  />
                </div>
                <div className="tw-col-span-full">
                  <SchemaTab
                    columnName={getPartialNameFromFQN(
                      dbtModelFQN,
                      ['column'],
                      '.'
                    )}
                    columns={columns}
                    hasEditAccess={hasEditAccess()}
                    joins={[]}
                    owner={owner}
                    onUpdate={onColumnsUpdate}
                  />
                </div>
              </div>
            )}
            {activeTab === 2 && (
              <div className="tw-mt-4">
                <ManageTab
                  currentTier=""
                  currentUser={owner?.id}
                  hasEditAccess={hasEditAccess()}
                  onSave={onSettingsUpdate}
                />
              </div>
            )}
            {activeTab === 3 && (
              <div className="tw-mt-4">
                <ManageTab
                  currentTier=""
                  currentUser={owner?.id}
                  hasEditAccess={hasEditAccess()}
                  onSave={onSettingsUpdate}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default DBTModelDetails;
