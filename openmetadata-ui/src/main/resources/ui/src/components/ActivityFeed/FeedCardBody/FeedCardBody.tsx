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
import { getFrontEndFormat } from '../../../utils/FeedUtils';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';
import { FeedBodyProp } from '../ActivityFeedCard/ActivityFeedCard.interface';

const FeedCardBody: FC<FeedBodyProp> = ({
  isAuthor,
  message,
  className,
  threadId,
  postId,
  onConfirmation,
}) => {
  return (
    <Fragment>
      <div className={classNames('tw-group', className)}>
        <RichTextEditorPreviewer
          className="activity-feed-card-text"
          enableSeeMoreVariant={false}
          markdown={getFrontEndFormat(message)}
        />
        {threadId && postId && onConfirmation && isAuthor ? (
          <span
            className="tw-opacity-0 group-hover:tw-opacity-100 tw-cursor-pointer"
            data-testid="delete-button"
            onClick={() => onConfirmation({ state: true, postId, threadId })}>
            <SVGIcons alt="delete" icon={Icons.DELETE} width="12px" />
          </span>
        ) : null}
      </div>
    </Fragment>
  );
};

export default FeedCardBody;
