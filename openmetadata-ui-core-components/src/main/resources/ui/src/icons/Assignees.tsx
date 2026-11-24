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

export const Assignees: FC<Props> = ({
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
      d="M12.379 15.839c0-.906 0-1.358-.112-1.727a2.6 2.6 0 0 0-1.73-1.73c-.368-.112-.82-.112-1.726-.112H5.568c-.906 0-1.358 0-1.727.112-.829.252-1.478.9-1.73 1.73C2 14.481 2 14.933 2 15.84m8.108-8.76a2.92 2.92 0 1 1-5.838.002 2.92 2.92 0 0 1 5.838-.001m4.247 4.964c.925 0 1.387 0 1.764.114a2.65 2.65 0 0 1 1.767 1.768c.115.377.115.839.115 1.764M13.09 9.446a2.047 2.047 0 1 0 0-4.094"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Assignees.displayName = 'Assignees';
