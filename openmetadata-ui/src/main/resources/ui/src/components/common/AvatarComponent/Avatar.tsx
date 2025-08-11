/*
 *  Copyright 2022 Collate.
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
import { ImageShape } from 'Models';
import { getRandomColor } from '../../../utils/CommonUtils';

const Avatar = ({
  name,
  width = '36',
  textClass = '',
  className = '',
  type = 'square',
  height,
}: {
  name: string;
  width?: string;
  textClass?: string;
  className?: string;
  type?: ImageShape;
  height?: string;
}) => {
  const { color, character } = getRandomColor(name);

  return (
    <div
      className={classNames('flex-center flex-shrink align-middle', className)}
      data-testid="avatar"
      style={{
        height: `${height || width}px`,
        width: `${width}px`,
        borderRadius: type === 'circle' ? '50%' : '4px',
        background: color,
        color: 'black',
        fontSize: `${Number(width) / 2}px`,
        fontWeight: 'normal',
      }}>
      <span className={classNames(textClass)}>{character}</span>
    </div>
  );
};

export default Avatar;
