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

const Avatar = ({
  name,
  width = '36',
  textClass = '',
  className = '',
}: {
  name: string;
  width?: string;
  textClass?: string;
  className?: string;
}) => {
  const getBgColorByCode = (code: number) => {
    if (code >= 65 && code <= 71) {
      return '#B02AAC40';
    }
    if (code >= 72 && code <= 78) {
      return '#7147E840';
    }
    if (code >= 79 && code <= 85) {
      return '#FFC34E40';
    } else {
      return '#1890FF40';
    }
  };

  return (
    <div
      className={classNames(
        'tw-flex tw-flex-shrink-0 tw-justify-center tw-items-center tw-align-middle',
        className
      )}
      style={{
        height: `${width}px`,
        width: `${width}px`,
        borderRadius: '50%',
        background: getBgColorByCode(name?.charCodeAt(0)),
        color: 'black',
      }}>
      <p className={classNames('tw-self-center tw-capitalize', textClass)}>
        {name?.[0]}
      </p>
    </div>
  );
};

export default Avatar;
