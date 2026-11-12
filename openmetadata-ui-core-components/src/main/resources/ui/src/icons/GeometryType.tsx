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

export const GeometryType: FC<Props> = ({
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
    viewBox="0 0 21 20"
    width={size}
    {...props}>
    <path
      d="M3.697 17.83h4.659a1 1 0 0 0 1-1v-4.658a1 1 0 0 0-1-1h-4.66a1 1 0 0 0-1 1v4.658a1 1 0 0 0 1 1m4.691-8.807h4.645a1 1 0 0 0 .866-1.5L11.575 3.5a1 1 0 0 0-1.732 0L7.521 7.523a1 1 0 0 0 .866 1.5"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={14.804}
      cy={14.499}
      r={3.5}
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
GeometryType.displayName = 'GeometryType';
