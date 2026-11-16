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

export const VariantType: FC<Props> = ({
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
      d="m4.437 12.583-.424-5.798m3.202 8.133 6.603-1.167m-7.196-1.054L11.716 7m-4.982 5.785a2.266 2.266 0 1 1-2.762 3.593 2.266 2.266 0 0 1 2.762-3.593ZM5.555 3.932A1.983 1.983 0 1 1 2.41 6.346a1.983 1.983 0 0 1 3.145-2.414Zm8.69.009a1.983 1.983 0 1 1-2.417 3.144 1.983 1.983 0 0 1 2.417-3.144Zm2.832 7.87a1.983 1.983 0 1 1-2.12 3.351 1.983 1.983 0 0 1 2.12-3.35Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
VariantType.displayName = 'VariantType';
