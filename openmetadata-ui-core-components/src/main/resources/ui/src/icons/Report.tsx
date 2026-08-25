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

export const Report: FC<Props> = ({
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
      d="M11.68 2.879A3 3 0 0 0 9.56 2H5.602a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8.8a2 2 0 0 0 2-2V8.428a2 2 0 0 0-.586-1.414z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.8 2.684v3.862A1.054 1.054 0 0 0 11.855 7.6h3.863M6.8 10.8h6.4M6.8 14h4.8"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Report.displayName = 'Report';
