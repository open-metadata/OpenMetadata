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

export const CuratedAssets: FC<Props> = ({
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
    <path
      d="M2 10c0-3.771 0-5.657 1.172-6.828S6.229 2 10 2s5.657 0 6.828 1.172S18 6.229 18 10s0 5.657-1.172 6.828S13.771 18 10 18s-5.657 0-6.828-1.172S2 13.771 2 10"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m10.727 6.397.741 1.494c.101.208.37.408.598.446l1.343.225c.859.144 1.06.773.442 1.392l-1.044 1.053a.93.93 0 0 0-.22.768l.3 1.303c.236 1.032-.308 1.431-1.213.892l-1.258-.751a.9.9 0 0 0-.834 0l-1.259.75c-.9.54-1.448.137-1.212-.89l.298-1.304a.93.93 0 0 0-.218-.768L6.146 9.954c-.614-.62-.416-1.248.443-1.392l1.343-.225a.92.92 0 0 0 .593-.446l.741-1.494c.404-.81 1.061-.81 1.461 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
CuratedAssets.displayName = 'CuratedAssets';
