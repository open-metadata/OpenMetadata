/*
 *  Copyright 2023 Collate.
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
import { Button, Dropdown, MenuProps, Space, Tag, Tooltip } from 'antd';
import { isUndefined, split } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconDropdown } from '../../../../assets/svg/menu.svg';
import { ReactComponent as ThumbsUpFilled } from '../../../../assets/svg/thumbs-up-filled.svg';
import { ReactComponent as ThumbsUpOutline } from '../../../../assets/svg/thumbs-up-outline.svg';
import { NO_PERMISSION_FOR_ACTION } from '../../../../constants/HelperTextUtil';
import { pluralize } from '../../../../utils/CommonUtils';
import { QueryVoteType } from '../TableQueries.interface';
import { QueryCardExtraOptionProps } from './QueryCardExtraOption.interface';

import { AxiosError } from 'axios';
import { deleteQuery } from '../../../../rest/queryAPI';
import { showErrorToast } from '../../../../utils/ToastUtils';
import { useAuthContext } from '../../../Auth/AuthProviders/AuthProvider';
import ConfirmationModal from '../../../Modals/ConfirmationModal/ConfirmationModal';
import './query-card-extra-option.style.less';

const QueryCardExtraOption = ({
  permission,
  query,
  onUpdateVote,
  onEditClick,
  afterDeleteAction,
}: QueryCardExtraOptionProps) => {
  const { EditAll, EditQueries, Delete } = permission;
  const { currentUser } = useAuthContext();
  const { t } = useTranslation();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loading, setLoading] = useState<QueryVoteType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const onDeleteClick = async () => {
    setIsDeleting(true);
    try {
      await deleteQuery(query.id || '');
      afterDeleteAction();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsDeleting(false);
    }
  };

  const dropdownItems = useMemo(() => {
    const items: MenuProps['items'] = [
      {
        key: 'edit-query',
        label: t('label.edit'),
        icon: (
          <EditIcon
            height={16}
            opacity={EditAll || EditQueries ? 1 : 0.5}
            width={16}
          />
        ),
        disabled: !(EditAll || EditQueries),
        onClick: () => onEditClick(true),
        title: EditAll || EditQueries ? undefined : NO_PERMISSION_FOR_ACTION,
      },
      {
        key: 'delete-query',
        label: t('label.delete'),
        icon: <DeleteIcon height={16} opacity={Delete ? 1 : 0.5} width={16} />,
        disabled: !Delete,
        onClick: () => setShowDeleteModal(true),
        title: Delete ? undefined : NO_PERMISSION_FOR_ACTION,
      },
    ];

    return items;
  }, [permission]);

  const queryLine = useMemo(() => {
    const lineCount = split(query.query, '\n').length;

    return pluralize(lineCount, t('label.line'));
  }, [query]);

  const voteStatus = useMemo(() => {
    const { votes } = query;
    const userId = currentUser?.id ?? '';
    if (isUndefined(votes)) {
      return QueryVoteType.unVoted;
    }

    const upVoters = votes.upVoters || [];
    const downVoters = votes.downVoters || [];

    if (upVoters.some((user) => user.id === userId)) {
      return QueryVoteType.votedUp;
    } else if (downVoters.some((user) => user.id === userId)) {
      return QueryVoteType.votedDown;
    } else {
      return QueryVoteType.unVoted;
    }
  }, [query, currentUser]);

  const handleVoteChange = async (type: QueryVoteType) => {
    let updatedVoteType;

    // current vote is same as selected vote, it means user is removing vote, else up/down voting
    if (voteStatus === type) {
      updatedVoteType = QueryVoteType.unVoted;
    } else {
      updatedVoteType = type;
    }
    setLoading(type);
    await onUpdateVote({ updatedVoteType }, query.id);
    setLoading(null);
  };

  return (
    <Space
      className="query-card-extra-option"
      data-testid="extra-option-container"
      size={8}>
      <Tag className="query-lines" data-testid="query-line">
        {queryLine}
      </Tag>
      <Tooltip title={t('label.up-vote')}>
        <Button
          className="vote-button"
          data-testid="up-vote-btn"
          icon={
            voteStatus === QueryVoteType.votedUp ? (
              <ThumbsUpFilled color="#008376" height={15} width={15} />
            ) : (
              <ThumbsUpOutline height={15} width={15} />
            )
          }
          loading={loading === QueryVoteType.votedUp}
          size="small"
          onClick={() => handleVoteChange(QueryVoteType.votedUp)}>
          {query.votes?.upVotes || 0}
        </Button>
      </Tooltip>

      <Tooltip title={t('label.down-vote')}>
        <Button
          className="vote-button"
          data-testid="down-vote-btn"
          icon={
            voteStatus === QueryVoteType.votedDown ? (
              <ThumbsUpFilled
                className="rotate-inverse"
                color="#E7B85D"
                height={15}
                width={15}
              />
            ) : (
              <ThumbsUpOutline
                className="rotate-inverse"
                height={15}
                width={15}
              />
            )
          }
          loading={loading === QueryVoteType.votedDown}
          size="small"
          onClick={() => handleVoteChange(QueryVoteType.votedDown)}>
          {query.votes?.downVotes || 0}
        </Button>
      </Tooltip>

      <Dropdown
        destroyPopupOnHide
        arrow={{ pointAtCenter: true }}
        menu={{
          items: dropdownItems,
          style: {
            minWidth: '120px',
          },
        }}
        placement="bottomRight"
        trigger={['click']}>
        <Tooltip
          title={t('label.manage-entity', {
            entity: t('label.query'),
          })}>
          <Button
            className="flex-center button-size"
            data-testid="query-btn"
            icon={<IconDropdown />}
            size="small"
            type="text"
          />
        </Tooltip>
      </Dropdown>
      <ConfirmationModal
        bodyText={t('message.delete-entity-permanently', {
          entityType: t('label.query'),
        })}
        cancelText={t('label.cancel')}
        confirmText={t('label.delete')}
        header={t('label.delete-entity', { entity: t('label.query') })}
        isLoading={isDeleting}
        visible={showDeleteModal}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={onDeleteClick}
      />
    </Space>
  );
};

export default QueryCardExtraOption;
