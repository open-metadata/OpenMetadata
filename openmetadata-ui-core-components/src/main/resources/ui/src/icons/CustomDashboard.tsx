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

export const CustomDashboard: FC<Props> = ({
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
      d="M14.667 18v-3.333m0 0v-3.334m0 3.334h3.334m-3.334 0h-3.333m.169-11.294c-.169.408-.169.926-.169 1.962 0 1.035 0 1.553.17 1.961.225.545.657.977 1.202 1.203.408.169.926.169 1.961.169s1.554 0 1.962-.17a2.22 2.22 0 0 0 1.202-1.202c.17-.408.17-.926.17-1.961s0-1.554-.17-1.962A2.22 2.22 0 0 0 16.63 2.17c-.409-.169-.926-.169-1.962-.169-1.035 0-1.553 0-1.961.17a2.22 2.22 0 0 0-1.203 1.202Zm-9.333 0C2 3.781 2 4.3 2 5.335s0 1.553.17 1.961c.225.545.657.977 1.202 1.203.408.169.926.169 1.961.169s1.553 0 1.962-.17a2.22 2.22 0 0 0 1.203-1.202c.169-.408.169-.926.169-1.961s0-1.554-.17-1.962A2.22 2.22 0 0 0 7.296 2.17c-.409-.169-.926-.169-1.962-.169-1.035 0-1.553 0-1.961.17A2.22 2.22 0 0 0 2.17 3.373Zm0 9.332c-.17.409-.17.926-.17 1.962 0 1.035 0 1.553.17 1.961.225.545.657.977 1.202 1.203.408.169.926.169 1.961.169s1.553 0 1.962-.17a2.22 2.22 0 0 0 1.203-1.202c.169-.408.169-.926.169-1.961s0-1.553-.17-1.962a2.22 2.22 0 0 0-1.202-1.203c-.409-.169-.926-.169-1.962-.169-1.035 0-1.553 0-1.961.17a2.22 2.22 0 0 0-1.203 1.202Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
CustomDashboard.displayName = 'CustomDashboard';
