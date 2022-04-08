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
import React, { FC } from 'react';
import SVGIcons, { Icons } from '../../../utils/SvgUtils';
import { MAX_LENGTH } from './RichTextEditorPreviewer';

interface BlurLayoutProp {
  markdown: string;
  enableSeeMoreVariant: boolean;
  displayMoreText: boolean;
  blurClasses: string;
  displayMoreHandler: () => void;
}

export const BlurLayout: FC<BlurLayoutProp> = ({
  enableSeeMoreVariant,
  markdown,
  displayMoreText,
  blurClasses,
  displayMoreHandler,
}: BlurLayoutProp) => {
  const getBlurClass = () => {
    return !displayMoreText ? blurClasses : '';
  };

  return enableSeeMoreVariant && markdown.length > MAX_LENGTH ? (
    <div
      className={classNames(
        'tw-absolute tw-flex tw-h-full tw-w-full tw-inset-x-0 tw-pointer-events-none',
        getBlurClass(),
        {
          'tw-top-0 tw-bottom-0': !displayMoreText,
          ' tw--bottom-4': displayMoreText,
        }
      )}
      data-testid="blur-layout">
      <p
        className="tw-cursor-pointer tw-self-end tw-pointer-events-auto tw-text-primary tw-mx-auto"
        data-testid="display-button"
        onClick={displayMoreHandler}>
        <span className="tw-flex tw-items-center tw-gap-2">
          <SVGIcons
            alt="expand-collapse"
            className={classNames({ 'rotate-inverse': displayMoreText })}
            icon={Icons.CHEVRON_DOWN}
            width="32"
          />
        </span>
      </p>
    </div>
  ) : null;
};
