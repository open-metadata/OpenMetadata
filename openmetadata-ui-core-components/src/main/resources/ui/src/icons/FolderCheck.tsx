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

export const FolderCheck: FC<Props> = ({
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
      d="M18 14.8V8.2A2.2 2.2 0 0 0 15.8 6h-5.068L9.635 4.1A2.2 2.2 0 0 0 7.73 3H4.2A2.2 2.2 0 0 0 2 5.2v9.6A2.2 2.2 0 0 0 4.2 17h11.6a2.2 2.2 0 0 0 2.2-2.2"
      fill="currentColor"
      stroke="none"
    />
    <path
      d="M10.732 6H15.8A2.2 2.2 0 0 1 18 8.2v6.6a2.2 2.2 0 0 1-2.2 2.2H4.2A2.2 2.2 0 0 1 2 14.8V5.2A2.2 2.2 0 0 1 4.2 3h3.53a2.2 2.2 0 0 1 1.905 1.1zm0 0H4.5"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      className="tw:fill-bg-primary"
      d="M4.5 5.352a.65.65 0 1 0 0 1.3zm6 1.3h.65v-1.3h-.65zm-6-.65v.65h3.116v-1.3H4.5zm3.116 0v.65H10.5v-1.3H7.616z"
      fill="#fff"
      stroke="none"
    />
    <path
      d="m8 11.286.747.854a1 1 0 0 0 1.506 0L13 9"
      fill="currentColor"
      stroke="none"
    />
    <path
      className="tw:stroke-bg-primary"
      d="m8 11.286.747.854a1 1 0 0 0 1.506 0L13 9"
      stroke="#fff"
      strokeWidth={1.3}
    />
  </svg>
);
FolderCheck.displayName = 'FolderCheck';
