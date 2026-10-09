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
import {
  Badge,
  Box,
  ButtonUtility,
  Dropdown,
} from '@openmetadata/ui-core-components';
import { Button, Tooltip } from 'antd';
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
import { Operation } from '../../../../generated/entity/policies/policy';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { useFqn } from '../../../../hooks/useFqn';
import { QueryVoteType } from '../../../../interface/entity/vote.interface';
import { deleteQuery } from '../../../../rest/queryAPI';
import { getDerivedPermissionFlags } from '../../../../utils/PermissionDerivation';
import queryClassBase from '../../../../utils/QueryClassBase';
import { getQueryPath } from '../../../../utils/RouterUtils';
import { pluralize } from '../../../../utils/StringUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ConfirmationModal from '../../../Modals/ConfirmationModal/ConfirmationModal';
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
    return [
      {
        key: 'edit-query',
        label: t('label.edit'),
        icon: EditIcon,
        disabled: !canEditQuery,
        onAction: () => onEditClick(true),
      },
      {
        key: 'delete-query',
        label: t('label.delete'),
        icon: DeleteIcon,
        disabled: !canDelete,
        onAction: () => setShowDeleteModal(true),
      },
    ];
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
    <Box
      inline
      align="center"
      className="layout-space layout-space-horizontal query-card-extra-option"
      data-testid="extra-option-container"
      gap={2}
      itemClassName="layout-space-item">
      {QueryHeaderButton && (
        <QueryHeaderButton onClickHandler={onExpandClick} />
      )}

      <Badge color="gray" data-testid="query-line" size="sm">
        {queryLine}
      </Badge>

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

      <Dropdown.Root>
        <ButtonUtility
          color="tertiary"
          data-testid="query-btn"
          icon={IconDropdown}
          size="xs"
          tooltip={t('label.manage-entity', {
            entity: t('label.query'),
          })}
        />
        <Dropdown.Popover className="tw:w-auto tw:min-w-30">
          <Dropdown.Menu
            aria-label={t('label.manage-entity', {
              entity: t('label.query'),
            })}
            disabledKeys={dropdownItems
              .filter((item) => item.disabled)
              .map((item) => item.key)}
            selectionMode="none">
            {dropdownItems.map((item) => (
              <Dropdown.Item
                data-testid={item.key}
                icon={item.icon}
                id={item.key}
                key={item.key}
                textValue={item.label}
                onAction={item.onAction}>
                {item.label}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
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
    </Box>
  );
};

export default QueryCardExtraOption;
