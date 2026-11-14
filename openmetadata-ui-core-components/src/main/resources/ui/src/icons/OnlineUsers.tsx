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

export const OnlineUsers: FC<Props> = ({
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
      d="M7.667 11.723H6.501c-1.086 0-1.629 0-2.07.133a3.11 3.11 0 0 0-2.074 2.075c-.134.441-.134.984-.134 2.07m9.722-10.5a3.5 3.5 0 1 1-7-.001 3.5 3.5 0 0 1 7 0M14.272 18a3.506 3.506 0 1 0 0-7.012 3.506 3.506 0 0 0 0 7.012"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M14.272 13.219v1.456c0 .108 0 .162.016.21a.3.3 0 0 0 .07.111c.034.036.082.06.179.108l.903.452"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
OnlineUsers.displayName = 'OnlineUsers';
