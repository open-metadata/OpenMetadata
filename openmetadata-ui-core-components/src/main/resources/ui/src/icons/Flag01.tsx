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

export const Flag01: FC<Props> = ({
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
      d="M3.336 5.836V17.5M9.8 3.257c-2.754-1.403-4.922-.58-6.002.259-.195.151-.292.227-.377.4s-.085.335-.085.658v7.701c.808-.914 3.232-2.332 6.464-.686 2.888 1.472 5.346.862 6.51.226.16-.088.241-.132.3-.23.058-.099.058-.205.058-.419V4.895c0-.69 0-1.036-.165-1.16-.164-.126-.549-.02-1.318.194-1.317.365-3.231.425-5.385-.672"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Flag01.displayName = 'Flag01';
