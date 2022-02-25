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
import React from 'react';
import { getRandomColor } from '../../../utils/CommonUtils';

const Avatar = ({
  name,
  width = '36',
  textClass = '',
  className = '',
  type = 'circle',
}: {
  name: string;
  width?: string;
  textClass?: string;
  className?: string;
  type?: 'circle' | 'square';
}) => {
  const { color, character } = getRandomColor(name);

  return (
    <div
      className={classNames(
        'tw-flex tw-flex-shrink-0 tw-justify-center tw-items-center tw-align-middle',
        className
      )}
      style={{
        height: `${width}px`,
        width: `${width}px`,
        borderRadius: type === 'circle' ? '50%' : '4px',
        background: color,
        color: 'black',
        fontSize: `${Number(width) / 2}px`,
        fontWeight: 'normal',
      }}>
      <p className={classNames('tw-self-center tw-capitalize', textClass)}>
        {character}
      </p>
    </div>
  );
};

export default Avatar;
