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

export const Classification: FC<Props> = ({
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
      d="m17 9.139-5.906-6.024c-.404-.411-.606-.617-.841-.764a2.3 2.3 0 0 0-.675-.285C9.31 2 9.024 2 8.454 2h-3.12M3 7.314v1.567c0 .388 0 .582.043.764q.057.245.186.459c.096.16.23.297.5.571l6.067 6.187c.616.629.924.943 1.279 1.06.312.104.649.104.961 0 .355-.117.663-.431 1.28-1.06L15.24 14.9c.616-.629.924-.943 1.04-1.305a1.6 1.6 0 0 0 0-.98c-.116-.363-.424-.677-1.04-1.305L9.562 5.52c-.269-.275-.403-.412-.56-.51a1.5 1.5 0 0 0-.45-.19c-.179-.044-.37-.044-.75-.044H5.49c-.871 0-1.307 0-1.64.173-.292.152-.53.395-.68.693C3 5.982 3 6.426 3 7.314"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M6.5 7.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0"
      fill="currentColor"
      stroke="none"
    />
  </svg>
);
Classification.displayName = 'Classification';
