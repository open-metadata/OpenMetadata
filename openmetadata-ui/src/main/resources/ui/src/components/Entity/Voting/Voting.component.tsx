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

import { Button, Tooltip, Typography } from 'antd';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as ThumbsDownFilled } from '../../../assets/svg/thumbs-down-filled.svg';
import { ReactComponent as ThumbsDownOutline } from '../../../assets/svg/thumbs-down-outline.svg';
import { ReactComponent as ThumbsUpFilled } from '../../../assets/svg/thumbs-up-filled.svg';
import { ReactComponent as ThumbsUpOutline } from '../../../assets/svg/thumbs-up-outline.svg';
import { DATA_ASSET_ICON_DIMENSION } from '../../../constants/constants';
import { QueryVoteType } from '../../Database/TableQueries/TableQueries.interface';
import { VotingProps } from './voting.interface';

const Voting = ({ votes, disabled, voteStatus, onUpdateVote }: VotingProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<QueryVoteType | null>(null);

  const handleVoteChange = async (type: QueryVoteType) => {
    let updatedVoteType;
    if (voteStatus === type) {
      updatedVoteType = QueryVoteType.unVoted;
    } else {
      updatedVoteType = type;
    }
    setLoading(type);
    await onUpdateVote({ updatedVoteType });
    setLoading(null);
  };

  return (
    <>
      <Tooltip title={t('label.up-vote')}>
        <Button
          className="w-16 p-0 flex-center"
          data-testid="up-vote-btn"
          disabled={disabled}
          icon={
            voteStatus === QueryVoteType.votedUp ? (
              <ThumbsUpFilled {...DATA_ASSET_ICON_DIMENSION} />
            ) : (
              <ThumbsUpOutline {...DATA_ASSET_ICON_DIMENSION} />
            )
          }
          loading={loading === QueryVoteType.votedUp}
          onClick={() => handleVoteChange(QueryVoteType.votedUp)}>
          <Typography.Text data-testid="up-vote-count">
            {votes?.upVotes ?? 0}
          </Typography.Text>
        </Button>
      </Tooltip>
      <Tooltip title={t('label.down-vote')}>
        <Button
          className="w-16 p-0 flex-center"
          data-testid="down-vote-btn"
          disabled={disabled}
          icon={
            voteStatus === QueryVoteType.votedDown ? (
              <ThumbsDownFilled {...DATA_ASSET_ICON_DIMENSION} />
            ) : (
              <ThumbsDownOutline {...DATA_ASSET_ICON_DIMENSION} />
            )
          }
          loading={loading === QueryVoteType.votedDown}
          onClick={() => handleVoteChange(QueryVoteType.votedDown)}>
          <Typography.Text data-testid="down-vote-count">
            {votes?.downVotes ?? 0}
          </Typography.Text>
        </Button>
      </Tooltip>
    </>
  );
};

export default Voting;
