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

export const CustomProperty: FC<Props> = ({
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
      d="M8.095 5.195H7.29c-.327 0-.634.138-.866.37a1.27 1.27 0 0 0-.36.899c0 .698-.55 1.247-1.226 1.247-.2 0-.412-.063-.581-.169-.582-.349-1.332-.137-1.67.465l-.424.73a1.285 1.285 0 0 0 .444 1.723c.381.222.614.645.614 1.1 0 .454-.233.866-.614 1.098a1.285 1.285 0 0 0-.444 1.724l.402.719c.159.295.423.507.74.602s.645.053.93-.116c.275-.17.614-.212.92-.127.317.084.582.296.74.592.106.18.159.391.17.602 0 .698.549 1.269 1.225 1.269h.804c.676 0 1.216-.56 1.226-1.258 0-.338.127-.655.36-.899.232-.243.539-.37.866-.37.201 0 .402.064.582.17.581.348 1.332.137 1.67-.466l.423-.729c.158-.285.211-.634.127-.962a1.25 1.25 0 0 0-.571-.772"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M7.693 13.317c.93 0 1.68-.783 1.68-1.745s-.75-1.744-1.68-1.744-1.681.782-1.681 1.744.75 1.745 1.68 1.745m2.972-9.854c0-1.036.01-1.385 1.332-1.385 1.321 0 1.332.349 1.332 1.385s0 1.385-1.332 1.385-1.332-.35-1.332-1.385m4.672 0c0-1.036.01-1.385 1.332-1.385 1.321 0 1.332.349 1.332 1.385s0 1.385-1.332 1.385-1.332-.35-1.332-1.385m-4.672 4.969c0-1.036.01-1.385 1.332-1.385 1.321 0 1.332.349 1.332 1.385s0 1.385-1.332 1.385-1.332-.35-1.332-1.385m4.672 0c0-1.036.01-1.385 1.332-1.385 1.321 0 1.332.349 1.332 1.385s0 1.385-1.332 1.385-1.332-.35-1.332-1.385"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
CustomProperty.displayName = 'CustomProperty';
