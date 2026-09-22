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

export const EditSkills: FC<Props> = ({
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
      d="M14.665 2v1.19m0 0c.592 0 1.128.24 1.515.628m-1.515-.627a2.14 2.14 0 0 0-1.515.627m3.03 0c.388.388.628.924.628 1.516m-.628-1.516.842-.842m-3.872.842a2.14 2.14 0 0 0-.627 1.516m.627-1.516-.842-.842m2.357 4.5v1.19m0-1.19a2.14 2.14 0 0 0 1.516-.627m-1.516.627a2.14 2.14 0 0 1-1.515-.627m3.03 0c.388-.388.628-.924.628-1.515m-.627 1.515.841.841m-3.872-.84a2.14 2.14 0 0 1-.627-1.515m.627 1.515-.842.841m5.69-2.357h-1.19m-4.285 0h-1.191m.169 11.293c-.169-.409-.169-.926-.169-1.962 0-1.035 0-1.553.17-1.961a2.22 2.22 0 0 1 1.202-1.203c.408-.169.926-.169 1.961-.169s1.553 0 1.962.17c.544.225.977.657 1.203 1.202.169.408.169.926.169 1.961s0 1.553-.17 1.962a2.22 2.22 0 0 1-1.202 1.203c-.409.169-.926.169-1.962.169-1.035 0-1.553 0-1.961-.17a2.22 2.22 0 0 1-1.203-1.202m-9.331 0C2 16.218 2 15.7 2 14.665s0-1.553.17-1.961A2.22 2.22 0 0 1 3.371 11.5c.408-.169.926-.169 1.961-.169s1.553 0 1.962.17c.544.225.977.657 1.203 1.202.169.408.169.926.169 1.961s0 1.553-.17 1.962a2.22 2.22 0 0 1-1.202 1.203c-.409.169-.926.169-1.962.169-1.035 0-1.553 0-1.961-.17a2.22 2.22 0 0 1-1.203-1.202m.002-9.331C2 6.886 2 6.369 2 5.333c0-1.035 0-1.553.17-1.961a2.22 2.22 0 0 1 1.202-1.203C3.78 2 4.298 2 5.333 2s1.553 0 1.962.17c.544.225.977.657 1.203 1.202.169.408.169.926.169 1.961s0 1.553-.17 1.962a2.22 2.22 0 0 1-1.202 1.203c-.409.169-.926.169-1.962.169-1.035 0-1.553 0-1.961-.17a2.22 2.22 0 0 1-1.203-1.202"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
EditSkills.displayName = 'EditSkills';
