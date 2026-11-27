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

export const Edit01: FC<Props> = ({
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
      d="M11.45 4.32c.52-.565.781-.848 1.058-1.013a2.17 2.17 0 0 1 2.172-.032c.282.156.55.43 1.088.98.537.55.806.824.96 1.112a2.3 2.3 0 0 1-.033 2.218c-.161.284-.438.55-.99 1.083l-6.581 6.34c-1.048 1.01-1.573 1.515-2.227 1.77-.655.257-1.375.238-2.816.2l-.195-.005c-.439-.012-.658-.017-.786-.162-.127-.145-.11-.368-.075-.815l.02-.242c.097-1.258.146-1.886.391-2.451s.67-1.024 1.516-1.942zm-.395.512 4.285 4.3M11.402 17h5.599"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Edit01.displayName = 'Edit01';
