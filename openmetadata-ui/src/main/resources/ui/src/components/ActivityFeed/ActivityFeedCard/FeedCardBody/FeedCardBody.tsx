/*
 *  Copyright 2021 Collate
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

import classNames from 'classnames';
import React, { FC, Fragment } from 'react';
import { getFrontEndFormat } from '../../../../utils/FeedUtils';
import RichTextEditorPreviewer from '../../../common/rich-text-editor/RichTextEditorPreviewer';
import Reactions from '../../../Reactions/Reactions';
import { FeedBodyProp } from '../ActivityFeedCard.interface';

const FeedCardBody: FC<FeedBodyProp> = ({
  message,
  className,
  reactions,
  onReactionSelect,
}) => {
  return (
    <Fragment>
      <div className={classNames('tw-group', className)}>
        <div className="tw-mt-2">
          <RichTextEditorPreviewer
            className="activity-feed-card-text"
            enableSeeMoreVariant={false}
            markdown={getFrontEndFormat(message)}
          />
        </div>
        {Boolean(reactions?.length) && (
          <Reactions
            reactions={reactions || []}
            onReactionSelect={onReactionSelect}
          />
        )}
      </div>
    </Fragment>
  );
};

export default FeedCardBody;
