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

export const Settings01: FC<Props> = ({
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
      d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M15.606 12.273a1.25 1.25 0 0 0 .25 1.379l.046.045a1.513 1.513 0 0 1 0 2.144 1.515 1.515 0 0 1-2.144 0l-.046-.046a1.25 1.25 0 0 0-1.378-.25 1.25 1.25 0 0 0-.758 1.144v.129a1.515 1.515 0 1 1-3.03 0v-.068a1.25 1.25 0 0 0-.817-1.144 1.25 1.25 0 0 0-1.379.25l-.045.046a1.515 1.515 0 0 1-2.588-1.072 1.52 1.52 0 0 1 .444-1.072l.045-.046a1.25 1.25 0 0 0 .25-1.378 1.25 1.25 0 0 0-1.143-.758h-.129a1.515 1.515 0 1 1 0-3.03h.066a1.25 1.25 0 0 0 1.144-.817 1.25 1.25 0 0 0-.25-1.379l-.046-.045a1.515 1.515 0 1 1 2.145-2.147l.045.045a1.25 1.25 0 0 0 1.379.25h.061a1.25 1.25 0 0 0 .758-1.143v-.129a1.515 1.515 0 0 1 3.03 0v.069a1.25 1.25 0 0 0 .758 1.144 1.25 1.25 0 0 0 1.378-.25l.045-.046a1.514 1.514 0 0 1 2.144 0 1.516 1.516 0 0 1 0 2.144l-.046.045a1.25 1.25 0 0 0-.25 1.379v.061a1.25 1.25 0 0 0 1.144.758h.129a1.515 1.515 0 0 1 0 3.03h-.068a1.25 1.25 0 0 0-1.144.758"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Settings01.displayName = 'Settings01';
