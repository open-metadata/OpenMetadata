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

export const SaveOutlined: FC<Props> = ({
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
      d="M13.448 2H9.11C5.76 2 4.083 2 3.041 3.041 2 4.083 2 5.76 2 9.111v1.778c0 3.352 0 5.028 1.041 6.07C4.083 18 5.76 18 9.111 18h1.778c3.352 0 5.028 0 6.07-1.041C18 15.917 18 14.24 18 10.889V6.552c0-.406 0-.608-.021-.803a3.56 3.56 0 0 0-.76-1.832c-.122-.153-.265-.297-.552-.584s-.43-.43-.584-.553a3.56 3.56 0 0 0-1.832-.758C14.056 2 13.854 2 13.448 2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M14.448 2.441v.445c0 1.676 0 2.514-.521 3.035-.52.52-1.359.52-3.035.52H9.114c-1.676 0-2.514 0-3.035-.52-.52-.521-.52-1.359-.52-3.035V2.44m8.889 15.117v-3.11c0-1.677 0-2.515-.521-3.036-.52-.52-1.359-.52-3.035-.52H9.114c-1.676 0-2.514 0-3.035.52-.52.521-.52 1.36-.52 3.035v3.111"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
SaveOutlined.displayName = 'SaveOutlined';
