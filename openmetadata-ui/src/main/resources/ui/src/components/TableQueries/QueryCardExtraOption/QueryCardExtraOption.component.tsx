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
import { Button, Dropdown, MenuProps, Space } from 'antd';
import { ReactComponent as IconDropdown } from 'assets/svg/menu.svg';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import { useClipboard } from 'hooks/useClipBoard';
import { isUndefined } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentUserId } from 'utils/CommonUtils';
import { QueryVoteType } from '../TableQueries.interface';
import { QueryCardExtraOptionProps } from './QueryCardExtraOption.interface';
import { ReactComponent as EditIcon } from '/assets/svg/ic-edit.svg';
import { ReactComponent as CopyIcon } from '/assets/svg/icon-copy.svg';
import { ReactComponent as ThumbsUpFilled } from '/assets/svg/thumbs-up-filled.svg';
import { ReactComponent as ThumbsUpOutline } from '/assets/svg/thumbs-up-outline.svg';

const QueryCardExtraOption = ({
  permission,
  query,
  onUpdateVote,
  onEditClick,
}: QueryCardExtraOptionProps) => {
  const { EditAll, EditQueries } = permission;
  const { t } = useTranslation();
  const { onCopyToClipBoard } = useClipboard(query.query);
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
        key: 'copy-query',
        label: t('label.copy'),
        icon: <CopyIcon height={16} width={16} />,
        onClick: onCopyToClipBoard,
      },
    ];

    return items;
  }, [permission]);

  const voteStatus = useMemo(() => {
    const { votes } = query;
    const userId = getCurrentUserId();
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
  }, [query, getCurrentUserId]);

  const handleVoteChange = (type: QueryVoteType) => {
    let updatedVoteType;

    // current vote is same as selected vote, it means user is removing vote, else up/down voting
    if (voteStatus === type) {
      updatedVoteType = QueryVoteType.unVoted;
    } else {
      updatedVoteType = type;
    }

    onUpdateVote({ updatedVoteType }, query.id);
  };

  return (
    <Space size={8}>
      <Button
        className="flex items-center gap-2"
        icon={
          voteStatus === QueryVoteType.votedUp ? (
            <ThumbsUpFilled color="#008376" height={16} width={16} />
          ) : (
            <ThumbsUpOutline height={16} width={16} />
          )
        }
        size="small"
        onClick={() => handleVoteChange(QueryVoteType.votedUp)}>
        {query.votes?.upVotes || 0}
      </Button>
      <Button
        className="flex items-center gap-2"
        icon={
          voteStatus === QueryVoteType.votedDown ? (
            <ThumbsUpFilled
              className="rotate-inverse"
              color="#E7B85D"
              height={16}
              width={16}
            />
          ) : (
            <ThumbsUpOutline
              className="rotate-inverse"
              height={16}
              width={16}
            />
          )
        }
        size="small"
        onClick={() => handleVoteChange(QueryVoteType.votedDown)}>
        {query.votes?.downVotes || 0}
      </Button>
      <Dropdown
        destroyPopupOnHide
        arrow={{ pointAtCenter: true }}
        menu={{ items: dropdownItems }}
        placement="bottom"
        trigger={['click']}>
        <Button className="flex-center" icon={<IconDropdown />} type="text" />
      </Dropdown>
    </Space>
  );
};

export default QueryCardExtraOption;
