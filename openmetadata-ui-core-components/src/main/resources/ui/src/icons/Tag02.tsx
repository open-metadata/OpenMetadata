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

export const Tag02: FC<Props> = ({
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
      d="m17.14 9.139-6.023-6.024c-.411-.411-.617-.617-.857-.764a2.4 2.4 0 0 0-.688-.285C9.298 2 9.007 2 8.425 2H5.243m-2.38 5.314v1.567c0 .388 0 .582.044.764q.059.245.19.459c.098.16.235.297.51.571l6.187 6.187c.628.629.942.943 1.304 1.06.319.104.662.104.98 0 .363-.117.677-.431 1.305-1.06l1.963-1.962c.628-.629.942-.943 1.06-1.305a1.6 1.6 0 0 0 0-.98c-.118-.363-.432-.677-1.06-1.305l-5.79-5.79c-.275-.275-.412-.412-.572-.51a1.6 1.6 0 0 0-.459-.19c-.182-.044-.376-.044-.764-.044H5.4c-.888 0-1.332 0-1.672.173a1.6 1.6 0 0 0-.693.693c-.173.34-.173.784-.173 1.672"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Tag02.displayName = 'Tag02';
