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

export const Configuration: FC<Props> = ({
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
      d="m10.822 10.433-.314-.544a.963.963 0 0 0-1.313-.355.958.958 0 0 1-1.442-.801.963.963 0 0 0-.962-.99H6.16a.96.96 0 0 0-.959.962.963.963 0 0 1-.962.949.9.9 0 0 1-.461-.129.963.963 0 0 0-1.313.355l-.336.552a.963.963 0 0 0 .35 1.313.963.963 0 0 1 0 1.668.96.96 0 0 0-.35 1.308l.318.549a.963.963 0 0 0 1.313.373.954.954 0 0 1 1.308.35c.083.14.127.298.129.46 0 .532.43.963.963.963h.63c.53 0 .96-.428.963-.958a.96.96 0 0 1 .963-.963c.162.005.32.049.461.13a.963.963 0 0 0 1.313-.35l.332-.554a.96.96 0 0 0-.35-1.313.958.958 0 0 1 0-1.663.963.963 0 0 0 .35-1.308z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M7.804 12.58a1.327 1.327 0 1 1-2.654 0 1.327 1.327 0 0 1 2.654 0M18 6.429v-.503a.773.773 0 0 0-.77-.774.77.77 0 0 1-.68-1.135.77.77 0 0 0-.272-1.075l-.438-.253a.77.77 0 0 0-1.053.285.773.773 0 0 1-1.05.273.74.74 0 0 1-.268-.275.773.773 0 0 0-1.054-.28l-.456.25a.773.773 0 0 0-.283 1.052.773.773 0 0 1-.67 1.159.77.77 0 0 0-.768.769l.001.508a.773.773 0 0 0 .763.786.765.765 0 0 1 .673 1.14.773.773 0 0 0 .283 1.056l.439.253a.773.773 0 0 0 1.053-.28.77.77 0 0 1 1.056-.282c.11.067.203.162.268.274a.773.773 0 0 0 1.053.283l.452-.25a.77.77 0 0 0 .284-1.053.769.769 0 0 1 .667-1.156.773.773 0 0 0 .768-.769zm-2.958.28a1.065 1.065 0 1 1-1.844-1.064 1.065 1.065 0 0 1 1.844 1.065"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Configuration.displayName = 'Configuration';
