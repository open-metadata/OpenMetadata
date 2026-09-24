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

import { ThumbsDown, ThumbsUp } from '@untitledui/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StatItem } from '../../DataAssets/DataAssetsHeader/StatItem.component';
import { QueryVoteType } from '../../Database/TableQueries/TableQueries.interface';
import { VotingProps } from './voting.interface';

const Voting = ({ votes, disabled, voteStatus, onUpdateVote }: VotingProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<QueryVoteType | null>(null);

  const handleVoteChange = async (type: QueryVoteType) => {
    const updatedVoteType = voteStatus === type ? QueryVoteType.unVoted : type;
    setLoading(type);
    await onUpdateVote({ updatedVoteType });
    setLoading(null);
  };

  return (
    <>
      <StatItem
        count={votes?.upVotes ?? 0}
        countTestId="up-vote-count"
        disabled={disabled}
        icon={ThumbsUp}
        isActive={voteStatus === QueryVoteType.votedUp}
        loading={loading === QueryVoteType.votedUp}
        testId="up-vote-btn"
        tooltip={t('label.up-vote')}
        onClick={() => handleVoteChange(QueryVoteType.votedUp)}
      />
      <StatItem
        count={votes?.downVotes ?? 0}
        countTestId="down-vote-count"
        disabled={disabled}
        icon={ThumbsDown}
        isActive={voteStatus === QueryVoteType.votedDown}
        loading={loading === QueryVoteType.votedDown}
        testId="down-vote-btn"
        tooltip={t('label.down-vote')}
        onClick={() => handleVoteChange(QueryVoteType.votedDown)}
      />
    </>
  );
};

export default Voting;
