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

export const CurrencyDollarSuccess: FC<Props> = ({
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
      d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.168 8.45c-.08-.61-.78-1.595-2.04-1.595-1.463 0-2.079.81-2.204 1.215-.195.543-.156 1.657 1.56 1.779 2.144.152 3.003.405 2.894 1.717-.11 1.313-1.305 1.596-2.25 1.566-.944-.03-2.49-.464-2.55-1.632m2.4-5.5v.857m0 6.267V14"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
CurrencyDollarSuccess.displayName = 'CurrencyDollarSuccess';
