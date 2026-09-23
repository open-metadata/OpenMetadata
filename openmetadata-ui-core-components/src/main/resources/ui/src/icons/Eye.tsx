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

export const Eye: FC<Props> = ({
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
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path
      d="M2.42 12.713c-.136-.229-.204-.343-.242-.52a1.3 1.3 0 0 1 0-.464c.038-.177.106-.291.242-.52C3.546 9.317 6.895 4.5 12 4.5s8.455 4.817 9.58 6.709c.137.229.205.343.243.52.029.133.029.331 0 .464-.038.177-.106.291-.242.52-1.126 1.892-4.476 6.709-9.58 6.709-5.106 0-8.455-4.817-9.58-6.709"
      stroke="currentColor"
      strokeWidth={2}
    />
    <path
      d="M12 14.96a3 3 0 1 0 0-5.999 3 3 0 0 0 0 6"
      stroke="currentColor"
      strokeWidth={2}
    />
  </svg>
);
Eye.displayName = 'Eye';
