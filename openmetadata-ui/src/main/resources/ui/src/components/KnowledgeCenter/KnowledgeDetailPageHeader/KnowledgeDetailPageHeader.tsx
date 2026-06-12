/*
 *  Copyright 2026 Collate.
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
import Icon, { LoadingOutlined } from '@ant-design/icons';
import {
  Button,
  Col,
  Popover,
  Row,
  Skeleton,
  Space,
  Spin,
  Tooltip,
  Typography,
} from 'antd';
import ButtonGroup from 'antd/lib/button/button-group';
import classNames from 'classnames';
import { isEmpty, isUndefined, map, toString, uniqBy, uniqueId } from 'lodash';
import { FC, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as ConversationIcon } from '../../../assets/svg/ic-conversation.svg';
import { ReactComponent as IconSaved } from '../../../assets/svg/ic-saved.svg';
import { ReactComponent as ShareIcon } from '../../../assets/svg/ic-share.svg';
import { ReactComponent as StarFilledIcon } from '../../../assets/svg/ic-star-filled.svg';
import { ReactComponent as StarIcon } from '../../../assets/svg/ic-star.svg';
import { ReactComponent as IconUnSaved } from '../../../assets/svg/ic-unsaved.svg';
import { ReactComponent as VersionIcon } from '../../../assets/svg/ic-version.svg';
import { DeleteType } from '../../../components/common/DeleteWidget/DeleteWidget.interface';
import ManageButton from '../../../components/common/EntityPageInfos/ManageButton/ManageButton';
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { QueryVoteType } from '../../../components/Database/TableQueries/TableQueries.interface';
import { EntityStatusBadge } from '../../../components/Entity/EntityStatusBadge/EntityStatusBadge.component';
import Voting from '../../../components/Entity/Voting/Voting.component';
import { VotingDataProps } from '../../../components/Entity/Voting/voting.interface';
import { ROUTES, TEXT_BODY_COLOR } from '../../../constants/constants';
import { EntityField } from '../../../constants/Feeds.constants';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { EntityStatus } from '../../../generated/entity/data/glossaryTerm';
import { useCurrentUserPreferences } from '../../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useClipboard } from '../../../hooks/useClipBoard';
import { useFqn } from '../../../hooks/useFqn';
import {
  ContentChangeState,
  KnowledgePage,
  RecentlyViewedQuickLinks,
} from '../../../interface/knowledge-center.interface';
import deleteWidgetClassBase from '../../../utils/DeleteWidget/DeleteWidgetClassBase';
import EntityLink from '../../../utils/EntityLink';
import { getEntityName } from '../../../utils/EntityNameUtils';
import i18n from '../../../utils/i18next/LocalUtil';
import { getKnowledgePageName, updateKnowledgeCenterRecentViewed } from '../../../utils/KnowledgePageUtils';
import { getKnowledgeVersionsPath } from '../../../utils/KnowledgePagePureUtils';;

export interface KnowledgeDetailPageHeaderProps {
  isLoading: boolean;
  contentChangeState: ContentChangeState;
  permissions: OperationPermission;
  knowledgePage?: KnowledgePage;
  onSetThreadLink: (link: string) => void;
  onVoteChange: (type: VotingDataProps) => Promise<void>;
  onFollowChange: () => Promise<void>;
  onToggleDelete: () => void;
  onSave?: () => void;
  fetchKnowledgePageHierarchy?: (forceRefresh?: boolean) => Promise<void>;
}

const KnowledgeDetailPageHeader: FC<KnowledgeDetailPageHeaderProps> = ({
  knowledgePage,
  contentChangeState,
  onSetThreadLink,
  onVoteChange,
  permissions,
  onFollowChange,
  onToggleDelete,
  onSave,
  isLoading,
  fetchKnowledgePageHierarchy,
}) => {
  const navigate = useNavigate();
  const { fqn } = useFqn();
  const { currentUser } = useApplicationStore();
  const USERId = currentUser?.id ?? '';
  const { t } = i18n;

  const [copyTooltip, setCopyTooltip] = useState<string>();
  const { onCopyToClipBoard } = useClipboard(window.location.href);
  const [isFollowLoading, setIsFollowLoading] = useState<boolean>(false);
  const {
    preferences: { recentlyViewedQuickLinks },
  } = useCurrentUserPreferences();
  const recentlyViewed =
    recentlyViewedQuickLinks as unknown as RecentlyViewedQuickLinks['data'];

  const breadcrumbs = useMemo(
    () => [
      {
        name: t('label.home'),
        url: ROUTES.HOME,
      },
      {
        name: t('label.knowledge-center'),
        url: ROUTES.KNOWLEDGE_CENTER,
      },
      {
        name: getKnowledgePageName(knowledgePage, t),
        url: '',
        activeTitle: false,
      },
    ],
    [knowledgePage?.displayName]
  );

  const entityStatusBadge = useMemo(() => {
    const shouldShowStatus = true;
    const entityStatus = knowledgePage?.entityStatus;

    if (
      !shouldShowStatus ||
      !entityStatus ||
      entityStatus === EntityStatus.Unprocessed
    ) {
      return null;
    }

    return <EntityStatusBadge showDivider={false} status={entityStatus} />;
  }, [knowledgePage?.entityStatus]);

  const contentChangeIcon = useMemo(() => {
    if (contentChangeState === ContentChangeState.SAVED) {
      return <IconSaved />;
    } else if (contentChangeState === ContentChangeState.SAVING) {
      return (
        <Spin
          indicator={
            <LoadingOutlined
              spin
              style={{ fontSize: '18px', color: TEXT_BODY_COLOR }}
            />
          }
        />
      );
    } else if (contentChangeState === ContentChangeState.UN_SAVED) {
      return <IconUnSaved />;
    } else {
      return null;
    }
  }, [contentChangeState]);

  const editors = useMemo(() => {
    const list = uniqBy(
      [
        ...(knowledgePage?.editors ?? []),
        ...[{ name: knowledgePage?.updatedBy }],
      ],
      'name'
    );

    return { upFrontList: list.slice(0, 5), popOverList: list.slice(5) };
  }, [knowledgePage]);

  const editorsPopoverElement = useMemo(
    () =>
      !isEmpty(editors.popOverList) && (
        <Popover
          className="editors-popover"
          content={
            <Space direction="vertical">
              {map(editors.popOverList, (user) => (
                <UserPopOverCard
                  showUserName
                  key={user.name}
                  profileWidth={24}
                  userName={user.name ?? ''}
                />
              ))}
            </Space>
          }
          trigger={['click', 'hover']}>
          <Typography className="text-grey-muted">{`+${editors.popOverList.length}`}</Typography>
        </Popover>
      ),
    [editors]
  );

  const voteStatus = useMemo(() => {
    if (isUndefined(knowledgePage?.votes)) {
      return QueryVoteType.unVoted;
    }

    const upVoters = knowledgePage?.votes.upVoters || [];
    const downVoters = knowledgePage?.votes.downVoters || [];

    if (upVoters.some((user) => user.id === USERId)) {
      return QueryVoteType.votedUp;
    } else if (downVoters.some((user) => user.id === USERId)) {
      return QueryVoteType.votedDown;
    } else {
      return QueryVoteType.unVoted;
    }
  }, [knowledgePage, USERId]);

  const { isFollowing, followers, version } = useMemo(() => {
    return {
      isFollowing: Boolean(
        knowledgePage?.followers?.some(({ id }) => id === USERId)
      ),
      followers: knowledgePage?.followers?.length ?? 0,
      version: knowledgePage?.version ?? '0.1',
    };
  }, [knowledgePage, USERId]);

  const { entityName, entityType } = useMemo(() => {
    return {
      entityName: getEntityName(knowledgePage),
      entityType: t('label.article'),
    };
  }, [knowledgePage]);

  const deleteOptions = [
    {
      title: `${t('label.permanently-delete')} ${entityType} “${entityName}”`,
      description: deleteWidgetClassBase.getDeleteMessage(
        entityName,
        entityType
      ),
      type: DeleteType.HARD_DELETE,
      isAllowed: true,
    },
  ];

  const handleVersionClick = () => {
    navigate(getKnowledgeVersionsPath(fqn, toString(version)));
  };

  const handleShareButtonClick = async () => {
    await onCopyToClipBoard();
    setCopyTooltip(t('message.copy-to-clipboard'));
    setTimeout(() => setCopyTooltip(''), 2000);
  };

  const handleFollowUnFollow = async () => {
    setIsFollowLoading(true);
    await onFollowChange();
    setIsFollowLoading(false);
  };

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => {
      updateKnowledgeCenterRecentViewed(
        recentlyViewed.filter((page) => page.id !== knowledgePage?.id)
      );
      isSoftDelete ? onToggleDelete() : navigate(ROUTES.KNOWLEDGE_CENTER);

      // fetch knowledge page hierarchy with force refresh to ensure updates are shown
      fetchKnowledgePageHierarchy?.(true);
    },
    [knowledgePage]
  );

  const showSaveButton =
    Boolean(onSave) &&
    contentChangeState === ContentChangeState.UN_SAVED &&
    (permissions.EditAll ||
      permissions.EditDescription ||
      permissions.EditDisplayName);

  if (isLoading) {
    return (
      <div className="p-y-sm p-x-sm w-full border-bottom bg-white flex justify-between">
        <Row>
          {Array(3)
            .fill(null)
            .map(() => (
              <Col key={uniqueId()}>
                <Skeleton
                  active
                  className="m-r-xs m-b-xss"
                  paragraph={{ rows: 1, width: 100 }}
                  title={false}
                />
              </Col>
            ))}
        </Row>
        <Row>
          {Array(3)
            .fill(null)
            .map(() => (
              <Col key={uniqueId()}>
                <Skeleton
                  active
                  className="m-r-xs m-b-xss"
                  paragraph={{ rows: 1, width: 100 }}
                  title={false}
                />
              </Col>
            ))}
        </Row>
      </div>
    );
  }

  return (
    <div className="p-y-sm p-x-sm w-full border bg-white rounded-12">
      <Row>
        <Col className="d-flex items-center gap-2" span={16}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
          {entityStatusBadge}
        </Col>
        <Col span={8}>
          <Space className="w-full justify-end" size={16}>
            <Space>
              <span className="content-change-icon">{contentChangeIcon}</span>
              <span
                className={classNames({
                  'content-change-text-success':
                    contentChangeState === ContentChangeState.SAVED,
                })}
                data-testid="content-change-state">
                {contentChangeState}
              </span>
            </Space>
            <Space
              className="author-avatar-group flex-center"
              data-testid="updated-by-list"
              size={0}>
              {map(editors.upFrontList, (user) => (
                <UserPopOverCard
                  key={user.name}
                  profileWidth={24}
                  userName={user.name ?? ''}
                />
              ))}

              {editorsPopoverElement}
            </Space>
            <Icon
              className="text-grey-muted cursor-pointer align-middle"
              component={ConversationIcon}
              data-testid="conversation"
              style={{
                fontSize: '20px',
              }}
              onClick={() =>
                onSetThreadLink(
                  EntityLink.getEntityLink(
                    EntityType.KNOWLEDGE_PAGE,
                    knowledgePage?.fullyQualifiedName ?? '',
                    EntityField.DESCRIPTION
                  )
                )
              }
            />
            {showSaveButton && (
              <Button data-testid="save-button" type="primary" onClick={onSave}>
                {t('label.save')}
              </Button>
            )}
            <ButtonGroup size="small">
              <Voting
                disabled={knowledgePage?.deleted}
                voteStatus={voteStatus}
                votes={knowledgePage?.votes}
                onUpdateVote={onVoteChange}
              />
              <Button
                className="w-16 p-0"
                data-testid="version-button"
                icon={<Icon component={VersionIcon} />}
                onClick={handleVersionClick}>
                <Typography.Text>{version}</Typography.Text>
              </Button>

              <Button
                className="w-16 p-0"
                data-testid="entity-follow-button"
                icon={
                  <Icon component={isFollowing ? StarFilledIcon : StarIcon} />
                }
                loading={isFollowLoading}
                onClick={handleFollowUnFollow}>
                <Typography.Text>{followers}</Typography.Text>
              </Button>

              <Tooltip
                open={!isEmpty(copyTooltip)}
                placement="bottomRight"
                title={copyTooltip}>
                <Button
                  data-testid="share-button"
                  icon={<Icon component={ShareIcon} />}
                  onClick={handleShareButtonClick}
                />
              </Tooltip>
              <ManageButton
                isRecursiveDelete
                afterDeleteAction={afterDeleteAction}
                allowSoftDelete={false}
                canDelete={permissions.Delete}
                deleteButtonDescription={t(
                  'message.delete-entity-type-action-description',
                  {
                    entityType: entityType,
                  }
                )}
                deleteOptions={deleteOptions}
                deleted={knowledgePage?.deleted}
                entityFQN={knowledgePage?.fullyQualifiedName}
                entityId={knowledgePage?.id}
                entityName={getKnowledgePageName(knowledgePage, t)}
                entityType={EntityType.KNOWLEDGE_CENTER}
                successMessage={t('server.entity-deleted-successfully', {
                  entity: entityType,
                })}
              />
            </ButtonGroup>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default KnowledgeDetailPageHeader;
