/*
 *  Copyright 2026 Collate.
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
import type { FC, SVGProps } from 'react';

interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const ConstraintNotNull: FC<Props> = ({
  size = 20,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 16 16"
    width={size}
    {...props}>
    <g clipPath="url(#constraint-not-null_a)">
      <path d="m.47 15.47 15-15" stroke="currentColor" strokeWidth={1.5} />
      <mask fill="#fff" id="constraint-not-null_b">
        <path d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0M2.31 8a5.69 5.69 0 1 0 11.38 0A5.69 5.69 0 0 0 2.31 8" />
      </mask>
      <path
        d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM2.31 8a5.69 5.69 0 1 0 11.38 0A5.69 5.69 0 0 0 2.31 8Z"
        mask="url(#constraint-not-null_b)"
        stroke="currentColor"
        strokeWidth={2}
      />
    </g>
    <defs>
      <clipPath id="constraint-not-null_a">
        <path d="M0 0h16v16H0z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
ConstraintNotNull.displayName = 'ConstraintNotNull';
