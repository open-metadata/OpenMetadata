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

export const ActivityConversation: FC<Props> = ({
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
    <g stroke="currentColor">
      <path d="M1 5.25q0-.579.02-1.125c.041-1.187.062-1.78.545-2.266.483-.487 1.093-.513 2.313-.565a50 50 0 0 1 4.244 0c1.22.052 1.83.078 2.313.565s.504 1.08.545 2.266a32 32 0 0 1 0 2.25c-.041 1.187-.062 1.78-.545 2.266-.483.487-1.093.513-2.313.565a48 48 0 0 1-1.137.035c-.37.007-.556.01-.719.072s-.3.18-.574.415l-1.09.934A.365.365 0 0 1 4 10.385V9.211l-.122-.005c-1.22-.052-1.83-.078-2.313-.565s-.504-1.08-.545-2.266Q1 5.829 1 5.25" />
      <path d="M6.063 5.25H6m-1.937 0H4m4.063 0H8m-1.875 0a.125.125 0 1 1-.25 0 .125.125 0 0 1 .25 0m-2 0a.125.125 0 1 1-.25 0 .125.125 0 0 1 .25 0m4 0a.125.125 0 1 1-.25 0 .125.125 0 0 1 .25 0" />
    </g>
  </svg>
);
ActivityConversation.displayName = 'ActivityConversation';
