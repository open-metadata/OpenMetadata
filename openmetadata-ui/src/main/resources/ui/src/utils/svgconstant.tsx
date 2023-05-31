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

/* eslint-disable max-len */
import classNames from 'classnames';
import React, { CSSProperties } from 'react';

export const dropdownIcon = ({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) => {
  return (
    <svg
      aria-hidden="true"
      className={classNames('d-inline-block h-4 w-4', className)}
      fill={style?.color}
      style={style}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8.00003 11C7.87216 11 7.74416 10.9512 7.64653 10.8535L2.64653 5.85353C2.45116 5.65816 2.45116 5.34178 2.64653 5.14653C2.84191 4.95128 3.15828 4.95116 3.35353 5.14653L8.00003 9.79303L12.6465 5.14653C12.8419 4.95116 13.1583 4.95116 13.3535 5.14653C13.5488 5.34191 13.5489 5.65828 13.3535 5.85353L8.35354 10.8535C8.25591 10.9512 8.12791 11 8.00003 11Z"
        strokeWidth="0.4"
      />
    </svg>
  );
};
