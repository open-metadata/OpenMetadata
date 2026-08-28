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

export const Tag: FC<Props> = ({
  size = 24,
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
      d="M17.573 11.129a.02.02 0 0 1 .013.032l-6.34 6.341a1.796 1.796 0 0 1-2.54 0l-6.194-6.194A1.8 1.8 0 0 1 2 10.052V3.947a1.975 1.975 0 0 1 1.975-1.974h6.104c.473.006.925.2 1.256.538l6.194 6.194a1.795 1.795 0 0 1 .03 2.391.02.02 0 0 0 .014.033"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M6.773 7.74a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Tag.displayName = 'Tag';
