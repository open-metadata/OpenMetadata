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

export const ActivityAssetCreated: FC<Props> = ({
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
    viewBox="0 0 12 12"
    width={size}
    {...props}>
    <path
      d="M9.5 6.5V4c0-1.414 0-2.121-.44-2.56C8.622 1 7.915 1 6.5 1h-2c-1.414 0-2.121 0-2.56.44C1.5 1.878 1.5 2.585 1.5 4v4c0 1.414 0 2.121.44 2.56.439.44 1.146.44 2.56.44H7M3.5 5.5h2m-2-2h4m3 6H9m0 0H7.5m1.5 0V11m0-1.5V8"
      stroke="currentColor"
    />
  </svg>
);
ActivityAssetCreated.displayName = 'ActivityAssetCreated';
