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
import React, { FC, HTMLAttributes } from 'react';
import EditorImg from '../../../assets/img/feedEditor.png';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';

interface NoFeedPlaceholderProp extends HTMLAttributes<HTMLDivElement> {
  entityName: string;
}

const NoFeedPlaceholder: FC<NoFeedPlaceholderProp> = ({
  className,
  entityName,
}) => {
  return (
    <div
      className={classNames('tw-mt-10 tw-text-base tw-font-medium', className)}
      data-testid="placeholder-container">
      <span data-testid="placeholder-message">{`There is no activity on the "${entityName}" yet. Start a conversation by clicking
      on the `}</span>
      <span data-testid="placeholder-icon">
        <SVGIcons alt="comments" icon={Icons.COMMENT_PLUS} width="20px" />
      </span>
      <span>{` to collaborate with other users.`}</span>

      <div data-testid="placeholder-image">
        <img
          alt="editor-image"
          className="tw-rounded tw-mt-2 tw-block tw-m-auto"
          data-testid="editor-image"
          loading="lazy"
          src={EditorImg}
          width="600px"
        />
      </div>
    </div>
  );
};

export default NoFeedPlaceholder;
