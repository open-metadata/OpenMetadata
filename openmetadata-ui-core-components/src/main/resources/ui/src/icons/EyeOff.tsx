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

export const EyeOff: FC<Props> = ({
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
      d="M8.953 4.243q.508-.075 1.047-.076c4.254 0 7.046 3.754 7.983 5.239.114.179.171.269.203.408a1 1 0 0 1 0 .373c-.032.138-.089.228-.203.41-.25.395-.631.951-1.136 1.554M5.603 5.596c-1.802 1.223-3.025 2.92-3.586 3.808-.114.181-.171.271-.202.41a1 1 0 0 0 0 .372c.032.139.088.228.202.408.938 1.485 3.729 5.239 7.983 5.239 1.716 0 3.193-.61 4.408-1.436M2.5 2.5l15 15M8.233 8.233a2.5 2.5 0 1 0 3.536 3.536"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
EyeOff.displayName = 'EyeOff';
