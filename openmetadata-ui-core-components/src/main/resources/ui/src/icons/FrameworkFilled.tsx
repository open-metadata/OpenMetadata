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

export const FrameworkFilled: FC<Props> = ({
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
      d="m2 14 8 4 8-4M2 10l8 4 8-4"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.223 2.111a.5.5 0 0 0-.447 0L2.894 5.552a.5.5 0 0 0 0 .895l6.882 3.44a.5.5 0 0 0 .447 0L13.999 8l3.106-1.553a.5.5 0 0 0 0-.895z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
FrameworkFilled.displayName = 'FrameworkFilled';
