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

export const AppDataContractValidationColored: FC<Props> = ({
  size = 20,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 32 32"
    width={size}
    {...props}>
    <rect
      fill="url(#app-data-contract-validation-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <path
      d="M19.9 12.1c-.03-1.01-.143-1.612-.56-2.029-.572-.571-1.492-.571-3.333-.571h-2.603c-1.84 0-2.76 0-3.332.571S9.5 11.561 9.5 13.4v5.2c0 1.838 0 2.758.572 3.329s1.492.571 3.332.571h2.603c1.84 0 2.76 0 3.332-.571.418-.417.53-1.02.561-2.029"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.3}
    />
    <path
      d="m20.068 14.541-3.343 3.343c-.03.03-.045.045-.058.062a.3.3 0 0 0-.029.047c-.01.019-.016.039-.03.079l-.304.916c-.098.293-.147.44-.112.537a.3.3 0 0 0 .182.182c.097.034.244-.014.537-.112l.916-.305c.04-.014.06-.02.079-.03a.3.3 0 0 0 .047-.029l.061-.057 3.343-3.343.765-.765c.176-.176.264-.264.311-.359a.65.65 0 0 0 0-.572c-.047-.095-.135-.183-.31-.359-.177-.176-.264-.264-.36-.31a.65.65 0 0 0-.572 0c-.095.046-.182.134-.358.31zm1.29 1.29-1.29-1.29m-8.617 6.006h.354c.107 0 .161 0 .209-.017a.3.3 0 0 0 .112-.069.7.7 0 0 0 .108-.18l.25-.5c.139-.277.208-.415.301-.46a.3.3 0 0 1 .257 0c.094.045.163.183.301.46l.25.5c.049.097.073.145.109.18a.3.3 0 0 0 .112.07.7.7 0 0 0 .209.016h.353M12.1 12.098h5.2m-5.2 2.597H16"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.3}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-data-contract-validation-colored_a"
        x1={48}
        x2={16}
        y1={16}
        y2={-16}>
        <stop stopColor="#764BA2" />
        <stop offset={1} stopColor="#667EEA" />
      </linearGradient>
    </defs>
  </svg>
);
AppDataContractValidationColored.displayName =
  'AppDataContractValidationColored';
