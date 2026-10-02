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

export const Send01: FC<Props> = ({
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
      d="m8.758 11.243 8.735-8.736m-8.63 9.008 2.187 5.623c.193.495.289.743.428.815.12.063.263.063.384 0 .139-.072.235-.32.428-.815l5.483-14.05c.175-.446.262-.67.214-.812a.42.42 0 0 0-.263-.263c-.142-.048-.366.04-.813.214L2.861 7.71c-.494.193-.742.29-.814.428a.42.42 0 0 0 0 .384c.072.139.32.235.815.428l5.623 2.186c.1.04.15.059.193.09q.056.04.097.096c.03.043.05.093.089.193"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Send01.displayName = 'Send01';
