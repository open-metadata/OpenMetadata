/*
 *  Copyright 2025 Collate.
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
import * as React from 'react';
import type { SVGProps, FC } from 'react';
interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const AnnouncementColored: FC<Props> = ({
  size = 24,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 89 89"
    width={size}
    {...props}>
    <path
      d="M0 28C0 12.536 12.536 0 28 0h33c15.464 0 28 12.536 28 28v33c0 15.464-12.536 28-28 28H28C12.536 89 0 76.464 0 61z"
      fill="#EFF8FF"
    />
    <path
      d="m33.833 47.166 2.1 8.399c.059.236.088.353.123.457a2.67 2.67 0 0 0 2.31 1.8c.107.01.23.01.474.01.304 0 .457 0 .586-.014a2.67 2.67 0 0 0 2.396-2.396c.012-.128.012-.28.012-.587V35.833M53.167 46.5a4.667 4.667 0 1 0 0-9.334m-11-1.333h-5a6 6 0 0 0 0 12h5c2.354 0 5.235 1.262 7.458 2.474 1.297.707 1.946 1.06 2.37 1.008a1.26 1.26 0 0 0 .922-.548c.249-.346.249-1.044.249-2.435V35.334c0-1.391 0-2.087-.25-2.435a1.26 1.26 0 0 0-.92-.548c-.426-.052-1.074.3-2.371 1.008-2.223 1.212-5.104 2.474-7.459 2.474Z"
      stroke="#175CD3"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
    />
  </svg>
);
AnnouncementColored.displayName = 'AnnouncementColored';
