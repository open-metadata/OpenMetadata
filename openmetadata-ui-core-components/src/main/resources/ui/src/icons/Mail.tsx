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

export const Mail: FC<Props> = ({
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
      d="M2.625 5.512 7.723 8.4c1.88 1.065 2.674 1.065 4.554 0l5.098-2.888"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M2.013 11.18c.052 2.452.078 3.678.983 4.587s2.164.94 4.683 1.003a92 92 0 0 0 4.642 0c2.519-.063 3.778-.095 4.683-1.003.905-.909.931-2.135.983-4.587.017-.789.017-1.573 0-2.361-.052-2.453-.078-3.679-.983-4.587-.905-.909-2.164-.94-4.683-1.004a92 92 0 0 0-4.642 0c-2.519.064-3.778.095-4.683 1.004-.905.908-.931 2.134-.983 4.587a55 55 0 0 0 0 2.36"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Mail.displayName = 'Mail';
