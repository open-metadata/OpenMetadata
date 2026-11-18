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

export const ConstraintSortRemoved: FC<Props> = ({
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
    <g clipPath="url(#constraint-sort-removed_a)">
      <path d="M8.5 5.5a.5.5 0 1 0-1 0V6a.5.5 0 1 0 1 0z" fill="#9F9F9F" />
      <path
        clipRule="evenodd"
        d="M4.75 4.5a1 1 0 0 1 1-1v-.75a2.25 2.25 0 1 1 4.5 0v.75a1 1 0 0 1 1 1V7a1 1 0 0 1-1 1H8.5v1h5a.5.5 0 0 1 .5.5v2.063a2 2 0 1 1-1 0V10H8.5v1.563a2 2 0 1 1-1 0V10H3v1.563a2 2 0 1 1-1 0V9.5a.5.5 0 0 1 .5-.5h5V8H5.75a1 1 0 0 1-1-1zm3.25 8a1 1 0 1 0 0 2 1 1 0 0 0 0-2M10.25 7V4.5h-4.5V7zm-1-4.25v.75h-2.5v-.75a1.25 1.25 0 0 1 2.5 0M1.5 13.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0m11 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0"
        fill="#9F9F9F"
        fillRule="evenodd"
      />
      <path d="M1 8h14" stroke="gray" strokeLinecap="round" />
    </g>
    <defs>
      <clipPath id="constraint-sort-removed_a">
        <path d="M0 0h16v16H0z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
ConstraintSortRemoved.displayName = 'ConstraintSortRemoved';
