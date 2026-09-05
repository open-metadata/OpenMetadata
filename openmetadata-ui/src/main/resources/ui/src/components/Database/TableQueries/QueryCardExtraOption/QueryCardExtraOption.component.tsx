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
import { AxiosError } from 'axios';
import { isUndefined, split } from 'lodash';
import Qs from 'qs';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as EditIcon } from '../../../../assets/svg/edit-new.svg';
import { ReactComponent as DeleteIcon } from '../../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconDropdown } from '../../../../assets/svg/menu.svg';
import { ReactComponent as ThumbsUpFilled } from '../../../../assets/svg/thumbs-up-filled.svg';
import { ReactComponent as ThumbsUpOutline } from '../../../../assets/svg/thumbs-up-outline.svg';
import { NO_PERMISSION_FOR_ACTION } from '../../../../constants/HelperTextUtil';
import { Operation } from '../../../../generated/entity/policies/policy';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useFqn } from '../../../../hooks/useFqn';
import { deleteQuery } from '../../../../rest/queryAPI';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import queryClassBase from '../../../../utils/QueryClassBase';
import { getQueryPath } from '../../../../utils/RouterUtils';
import { pluralize } from '../../../../utils/StringUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ConfirmationModal from '../../../Modals/ConfirmationModal/ConfirmationModal';
import { QueryVoteType } from '../TableQueries.interface';
import './query-card-extra-option.style.less';
import { QueryCardExtraOptionProps } from './QueryCardExtraOption.interface';

const QueryCardExtraOption = ({
  permission,
  query,
  onUpdateVote,
  onEditClick,
  afterDeleteAction,
}: QueryCardExtraOptionProps) => {
  // Derive named flags instead of destructuring raw EditAll off `permission`.
  // EditQueries has no dedicated canEditX flag, so `can(Operation.X)` is the
  // sanctioned escape hatch. This is NOT the same computation as the old raw
  // `EditAll || EditQueries` OR — it's the prioritized (field-over-EditAll)
  // derivation: an explicit EditQueries value, when present, wins outright
  // over EditAll (explicit-deny-wins when EditQueries is false, same
  // precedent as canViewBasic, Task 6 Finding 1); EditAll is only a fallback
  // for when the EditQueries key is absent. See the file's tests for the
  // scenario where this diverges from the old raw OR.
  const { canDelete, can } = useMemo(
    () => getDerivedPermissionFlags(permission),
    [permission]
  );
  const canEditQuery = can(Operation.EditQueries);
  const { fqn: datasetFQN } = useFqn();
  const navigate = useNavigate();
  const QueryHeaderButton = queryClassBase.getQueryHeaderActionsButtons();
  const { currentUser } = useApplicationStore();
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

  const onExpandClick = useCallback(() => {
    navigate({
      search: Qs.stringify({ query: query.id }),
      pathname: getQueryPath(datasetFQN, query.id ?? ''),
    });
  }, [query]);

  const dropdownItems = useMemo(() => {
    const items: MenuProps['items'] = [
      {
        key: 'edit-query',
        label: t('label.edit'),
        icon: (
          <EditIcon height={16} opacity={canEditQuery ? 1 : 0.5} width={16} />
        ),
        disabled: !canEditQuery,
        onClick: () => onEditClick(true),
        title: canEditQuery ? undefined : t(NO_PERMISSION_FOR_ACTION),
      },
      {
        key: 'delete-query',
        label: t('label.delete'),
        icon: (
          <DeleteIcon height={16} opacity={canDelete ? 1 : 0.5} width={16} />
        ),
        disabled: !canDelete,
        onClick: () => setShowDeleteModal(true),
        title: canDelete ? undefined : t(NO_PERMISSION_FOR_ACTION),
      },
    ];

    return items;
  }, [canEditQuery, canDelete]);

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
      {QueryHeaderButton && (
        <QueryHeaderButton onClickHandler={onExpandClick} />
      )}

      <Tag className="query-lines" data-testid="query-line">
        {queryLine}
      </Tag>

      <Tooltip title={t('label.up-vote')}>
        <Button
          className="vote-button"
          data-testid="up-vote-btn"
          icon={
            voteStatus === QueryVoteType.votedUp ? (
              <ThumbsUpFilled className="text-success" height={15} width={15} />
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
                className="rotate-inverse text-warning-7"
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
