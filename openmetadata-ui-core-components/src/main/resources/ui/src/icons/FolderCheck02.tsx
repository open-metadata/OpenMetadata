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

export const FolderCheck02: FC<Props> = ({
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
      d="M10.732 6H15.8A2.2 2.2 0 0 1 18 8.2v6.6a2.2 2.2 0 0 1-2.2 2.2H4.2A2.2 2.2 0 0 1 2 14.8V5.2A2.2 2.2 0 0 1 4.2 3h3.53a2.2 2.2 0 0 1 1.905 1.1zm0 0H4.5"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m8 11.286.747.854a1 1 0 0 0 1.506 0L13 9"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
FolderCheck02.displayName = 'FolderCheck02';
