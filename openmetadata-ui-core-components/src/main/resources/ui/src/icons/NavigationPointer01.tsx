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

export const NavigationPointer01: FC<Props> = ({
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
      d="M2.844 8.954c-.496-.193-.744-.29-.817-.429a.42.42 0 0 1 0-.384c.073-.139.321-.236.817-.429L16.917 2.22c.448-.175.672-.262.815-.215a.42.42 0 0 1 .263.263c.048.143-.04.367-.215.814l-5.492 14.073c-.193.496-.29.744-.429.817a.42.42 0 0 1-.385 0c-.139-.073-.235-.321-.428-.817l-2.19-5.632a1 1 0 0 0-.089-.193.4.4 0 0 0-.097-.097 1 1 0 0 0-.193-.088l-5.632-2.19Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
NavigationPointer01.displayName = 'NavigationPointer01';
