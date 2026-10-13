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

export const AppCollateAiTierAgent: FC<Props> = ({
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
      d="m11.389 5.48-.523-.906a1 1 0 0 0-1.732 0L2.866 15.431a1 1 0 0 0 .866 1.5h12.536a1 1 0 0 0 .866-1.5l-2.528-4.379M6.64 8.953h2.52m-4.2 3.36h10.078"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.827 8.812a.003.003 0 0 0-.003.004l.204.721a.14.14 0 0 0 .13.1.13.13 0 0 0 .13-.1l.205-.725a1.98 1.98 0 0 1 1.365-1.366l.724-.206a.14.14 0 0 0 .1-.13.13.13 0 0 0-.1-.13l-.724-.205a1.98 1.98 0 0 1-1.365-1.367l-.205-.724c-.03-.115-.221-.115-.252 0l-.206.724a1.98 1.98 0 0 1-1.364 1.367l-.724.206a.14.14 0 0 0-.1.13.13.13 0 0 0 .1.13l.724.205c.662.19 1.172.7 1.363 1.362q0 .004-.003.004"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AppCollateAiTierAgent.displayName = 'AppCollateAiTierAgent';
