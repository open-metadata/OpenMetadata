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

import { isNil } from 'lodash';
import React, { CSSProperties, FunctionComponent, useState } from 'react';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import PopOver from '../common/popover/PopOver';

const GithubStarButton: FunctionComponent = () => {
  const [open, setOpen] = useState<boolean>(true);

  const handleClick = (isOpen?: boolean) => {
    setOpen((pre) => (!isNil(isOpen) ? isOpen : !pre));
  };

  return (
    <div className="tw-fixed tw-bottom-8 tw-right-8">
      <PopOver
        delay={100}
        html={
          <>
            <a
              className="link-text-grey tw-text-sm tw-font-medium"
              href="https://github.com/open-metadata/OpenMetadata"
              rel="noopener noreferrer"
              target="_blank">
              <span className="tw-mr-1">Star us on Github</span>
              <SVGIcons
                alt="external-link"
                className="tw-align-middle"
                icon={Icons.EXTERNAL_LINK_GREY}
                width="12px"
              />
            </a>
          </>
        }
        open={open}
        popperOptions={{
          modifiers: {
            addZIndex: {
              enabled: true,
              order: 810,
              // react-tippy has this dataObject that can be of any type
              fn: (data: { styles: CSSProperties }) => ({
                ...data,
                styles: {
                  ...data.styles,
                  zIndex: 9990,
                },
              }),
            },
          },
        }}
        position="left"
        theme="light"
        trigger="click">
        <button
          className="tw-h-12 tw-w-12 tw-rounded-full tw-shadow-lg tw-cursor-pointer tw-bg-white"
          onClick={() => handleClick()}>
          <SVGIcons
            alt="gh-star"
            data-testid="gh-star"
            icon={Icons.GITHUB_STAR}
            width="30"
          />
        </button>
      </PopOver>
    </div>
  );
};

export default GithubStarButton;
