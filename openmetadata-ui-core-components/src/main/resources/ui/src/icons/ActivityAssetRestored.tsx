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

export const ActivityAssetRestored: FC<Props> = ({
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
      d="M2.441 12.636A8 8 0 0 0 17.995 10a8 8 0 0 0-7.999-8c-3.289 0-6.31 2.378-7.385 4.889"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10 5.557V10l2.666 1.778m-6.67-4.671s-3.274.497-3.771 0 0-3.771 0-3.771"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ActivityAssetRestored.displayName = 'ActivityAssetRestored';
