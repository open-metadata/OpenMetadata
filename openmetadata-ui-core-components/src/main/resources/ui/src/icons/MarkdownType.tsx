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

export const MarkdownType: FC<Props> = ({
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
      d="M2 10c0-3.771 0-4.657 1.172-5.828S6.229 3 10 3s5.657 0 6.828 1.172S18 6.229 18 10c0 2.771 0 4.657-1.172 5.829S13.771 17 10 17s-5.657 0-6.828-1.171S2 12.77 2 10"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M7.504 11.51h-.08a.4.4 0 0 1-.334-.148q-.12-.153-.18-.326l-.765-2.204h-.104v3.354a.94.94 0 0 1-.097.459q-.096.168-.442.168-.387 0-.495-.164-.108-.165-.109-.463V8.1q0-.256.029-.462a.56.56 0 0 1 .156-.33q.13-.124.419-.124h.547q.209 0 .33.036.12.036.237.229.072.117.172.362.093.233.218.6l.305.896.105.322h.096l.129-.403q.081-.252.153-.466l.128-.39q.117-.35.206-.575a3 3 0 0 1 .16-.354q.105-.185.222-.221.12-.036.321-.036h.587q.29 0 .415.124.128.12.156.33.033.205.033.462v4.086q0 .297-.109.463-.108.165-.495.165-.341 0-.442-.17a.94.94 0 0 1-.096-.458V8.832h-.113l-.756 2.204a1.4 1.4 0 0 1-.181.326q-.108.149-.326.149"
      fill="currentColor"
    />
    <path
      d="M13.742 7.707v4.491m1.61-1.408-1.604 1.603-1.604-1.604"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
MarkdownType.displayName = 'MarkdownType';
