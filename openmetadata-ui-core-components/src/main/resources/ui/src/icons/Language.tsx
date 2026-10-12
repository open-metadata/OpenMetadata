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

export const Language: FC<Props> = ({
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
      d="M2 3.412h4.235m0 0h5.177m-5.177 0V2m-2.823 9.412c2.353-1.883 5.176-5.647 5.647-8M4.823 5.765C5.294 7.176 7.176 9.529 8.117 10"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M3.41 11.41c2.353-1.882 5.176-5.647 5.647-8M9.527 18l2.505-5.845c.74-1.726 1.11-2.589 1.73-2.589.621 0 .991.863 1.73 2.59L17.999 18m-6.585-3.766h4.706"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Language.displayName = 'Language';
