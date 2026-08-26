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

export const AgentDetails: FC<Props> = ({
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
      d="M2 10.002c0-3.017 0-4.526.89-5.463s2.324-.937 5.19-.937h3.84c2.866 0 4.3 0 5.19.937s.89 2.446.89 5.463 0 4.525-.89 5.462c-.89.938-2.324.938-5.19.938H8.08c-2.866 0-4.3 0-5.19-.938S2 13.018 2 10.002"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M10.405 13.603c-.1-1.28-1.145-2.292-2.452-2.377l-.348-.023q-.186.005-.35.013c-1.295.062-2.35 1.12-2.45 2.387M9 7.802a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 0 1 2.8 0m3.004-.2h3.2m-3.2 2.8h3.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AgentDetails.displayName = 'AgentDetails';
