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

export const DownVote: FC<Props> = ({
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
      d="M18 9.6a1.6 1.6 0 0 1-1.6 1.6A2.4 2.4 0 0 1 14 8.8V5.6a2.4 2.4 0 0 1 2.4-2.4A1.6 1.6 0 0 1 18 4.8z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m7.22 13.355.213-.688c.175-.564.262-.846.195-1.068a.8.8 0 0 0-.336-.438c-.201-.126-.505-.126-1.113-.126h-.323c-2.056 0-3.084 0-3.57-.609a1.6 1.6 0 0 1-.148-.221c-.373-.679.051-1.593.9-3.422.78-1.679 1.17-2.518 1.894-3.012q.105-.072.216-.135c.762-.437 1.706-.437 3.594-.437h.41c2.287 0 3.43 0 4.141.689.71.688.71 1.796.71 4.013v.779c0 1.164 0 1.747-.206 2.28-.207.532-.602.97-1.394 1.847L9.13 16.432a2 2 0 0 1-.159.168.827.827 0 0 1-1.155-.073 2 2 0 0 1-.135-.187 7 7 0 0 1-.21-.314 3.05 3.05 0 0 1-.356-2.311c.022-.088.05-.179.106-.36"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DownVote.displayName = 'DownVote';
