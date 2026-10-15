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

export const Key01: FC<Props> = ({
  size = 20,
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
      d="M14.167 7.5a1.66 1.66 0 0 0-.488-1.178 1.66 1.66 0 0 0-1.179-.489m0 6.667a5 5 0 1 0-4.955-4.327c.048.362.073.543.057.658a.7.7 0 0 1-.097.288c-.057.101-.156.2-.355.399l-4.258 4.258c-.144.144-.217.217-.268.3a.8.8 0 0 0-.1.242c-.024.095-.024.197-.024.401v1.448c0 .467 0 .7.091.878a.83.83 0 0 0 .364.364c.178.091.412.091.878.091h2v-1.667H7.5v-1.667h1.667l1.317-1.317c.198-.198.298-.297.398-.354a.7.7 0 0 1 .288-.097c.115-.017.296.008.658.057q.33.045.673.045Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Key01.displayName = 'Key01';
