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
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <rect
      fill="currentColor"
      height={15.47}
      rx={2.2}
      stroke="currentColor"
      strokeWidth={1.3}
      width={12.6}
      x={3.699}
      y={2.266}
    />
    <path
      className="tw:fill-bg-primary"
      d="m11.88 8.884 1.476 1.174a.5.5 0 0 0 .811-.391v-6.39a.5.5 0 0 0-.5-.5H9.469a.5.5 0 0 0-.5.5v6.39a.5.5 0 0 0 .811.391l1.477-1.174a.5.5 0 0 1 .622 0"
      fill="#fff"
      stroke="currentColor"
    />
  </svg>
);
GlossaryFilled.displayName = 'GlossaryFilled';
