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

export const GlossaryFilled: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M13 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3"
      fill="currentColor"
    />
    <path
      className="tw:fill-bg-primary tw:stroke-bg-primary"
      d="M13.174 10.489a.5.5 0 0 1-.854.353l-.88-.88a.5.5 0 0 0-.707 0l-.88.88A.5.5 0 0 1 9 10.49V3.696A.696.696 0 0 1 9.696 3h2.782a.696.696 0 0 1 .696.696z"
      fill="#fff"
      stroke="#fff"
      strokeWidth={1.2}
    />
  </svg>
);
GlossaryFilled.displayName = 'GlossaryFilled';
