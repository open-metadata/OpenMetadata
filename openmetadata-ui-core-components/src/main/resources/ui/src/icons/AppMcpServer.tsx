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

export const AppMcpServer: FC<Props> = ({
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
      d="m2.648 9.784 7.068-7.068a2.446 2.446 0 1 1 3.46 3.46M11.73 18l-1.118-1.118a.865.865 0 0 1 0-1.223l6.023-6.024a2.446 2.446 0 0 0-3.46-3.459l-5.337 5.338"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m14.756 8.053-5.338 5.338a2.446 2.446 0 0 1-3.46-3.46l5.338-5.337"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AppMcpServer.displayName = 'AppMcpServer';
