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

export const ThumbsDownFilled: FC<Props> = ({
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
      className="tw:fill-bg-secondary"
      d="M18 9.6a1.6 1.6 0 0 1-1.6 1.6A2.4 2.4 0 0 1 14 8.8V5.6a2.4 2.4 0 0 1 2.4-2.4A1.6 1.6 0 0 1 18 4.8z"
      fill="#fff"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m7.218 13.355.213-.688c.174-.564.262-.845.194-1.068a.8.8 0 0 0-.336-.438c-.2-.126-.504-.126-1.112-.126h-.323c-2.056 0-3.084 0-3.57-.609a1.6 1.6 0 0 1-.148-.22c-.373-.68.051-1.594.9-3.423.78-1.679 1.17-2.518 1.894-3.012q.105-.072.216-.135c.762-.437 1.706-.437 3.594-.437h.41c2.287 0 3.43 0 4.14.689.711.688.711 1.796.711 4.013v.779c0 1.164 0 1.747-.206 2.28-.207.533-.603.97-1.394 1.847l-3.274 3.625a2 2 0 0 1-.16.168.827.827 0 0 1-1.154-.073 2 2 0 0 1-.135-.187c-.108-.157-.162-.235-.21-.313a3.05 3.05 0 0 1-.356-2.312c.022-.088.05-.179.106-.36"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ThumbsDownFilled.displayName = 'ThumbsDownFilled';
