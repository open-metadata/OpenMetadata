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

export const Pin: FC<Props> = ({
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
      d="m2 18.001 4.384-4.384m4.828 2.3c-3.283-.745-6.384-3.847-7.129-7.129-.118-.52-.177-.78-.006-1.2.17-.422.38-.553.797-.813.944-.59 1.966-.778 3.026-.684 1.489.132 2.233.198 2.604.004.371-.193.623-.645 1.128-1.55L12.27 3.4c.421-.754.631-1.132 1.127-1.31.495-.177.793-.07 1.389.146a4.94 4.94 0 0 1 2.978 2.978c.216.596.323.894.145 1.39-.177.495-.555.705-1.31 1.126l-1.172.654c-.903.503-1.354.755-1.547 1.13-.194.375-.123 1.103.017 2.558.103 1.071-.075 2.1-.672 3.055-.261.418-.392.627-.813.797s-.681.112-1.201-.006"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Pin.displayName = 'Pin';
