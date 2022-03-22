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

import { CookieStorage } from 'cookie-storage';
import { isNil } from 'lodash';
import React, { FunctionComponent, useEffect, useRef, useState } from 'react';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import PopOver from '../common/popover/PopOver';

const cookieStorage = new CookieStorage();

const GithubStarButton: FunctionComponent = () => {
  const [open, setOpen] = useState<boolean>(!cookieStorage.getItem('gh-star'));
  const isMounting = useRef(true);

  const handleClick = (isOpen?: boolean) => {
    if (!isMounting.current) {
      cookieStorage.setItem('gh-star', 'true', {
        expires: new Date(Date.now() + 60 * 60 * 24 * 7 * 1000),
      });
      setOpen((pre) => (!isNil(isOpen) ? isOpen : !pre));
    }
  };

  // alwyas Keep this useEffect at the end...
  useEffect(() => {
    isMounting.current = false;
  }, []);

  return (
    <div className="tw-fixed tw-bottom-8 tw-right-8">
      <PopOver
        delay={100}
        html={
          <>
            <div className="tw-flex tw-items-center">
              <h6 className="tw-flex tw-heading tw-text-base tw-font-medium tw-m-0">
                Star us on Github
              </h6>
            </div>
            <hr className="tw-my-1" />
            <a
              className="link-text tw-text-sm"
              href="https://github.com/open-metadata/OpenMetadata"
              rel="noopener noreferrer"
              target="_blank">
              <span className="tw-mr-1">Please rate us on Github</span>
              <SVGIcons
                alt="external-link"
                className="tw-align-middle"
                icon="external-link"
                width="12px"
              />
            </a>
          </>
        }
        open={open}
        position="left"
        theme="light"
        trigger="click"
        onRequestClose={() => handleClick(false)}>
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
