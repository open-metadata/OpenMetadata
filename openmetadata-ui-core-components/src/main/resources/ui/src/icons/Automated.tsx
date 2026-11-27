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

export const Automated: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M15.113 11.07a2.69 2.69 0 0 0 .95 2.083c.134.112.201.168.226.22a.24.24 0 0 1 .024.148c-.006.057-.045.12-.122.248l-1.01 1.673c-.078.128-.116.191-.164.224a.24.24 0 0 1-.142.047c-.057.002-.138-.03-.3-.096-1.548-.632-3.341.321-3.632 1.958-.031.175-.047.262-.08.31a.24.24 0 0 1-.116.095c-.054.023-.13.02-.28.016l-1.99-.053c-.146-.004-.22-.006-.271-.031a.24.24 0 0 1-.111-.1c-.03-.048-.042-.133-.066-.303-.235-1.684-1.988-2.743-3.589-2.168-.161.059-.242.088-.299.083a.24.24 0 0 1-.14-.052c-.045-.034-.081-.098-.153-.226l-.973-1.736c-.074-.132-.111-.197-.116-.255a.24.24 0 0 1 .03-.147c.027-.052.097-.106.237-.215 1.314-1.02 1.322-3.05.042-4.127-.133-.113-.2-.169-.225-.22a.24.24 0 0 1-.024-.149c.007-.057.045-.12.122-.248l1.011-1.673c.077-.127.115-.191.163-.224a.24.24 0 0 1 .142-.047c.058-.002.139.03.3.097 1.549.631 3.343-.321 3.635-1.958.03-.174.046-.262.08-.31a.24.24 0 0 1 .116-.095c.053-.022.129-.02.28-.016l1.672.045"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.429 10.455A2.435 2.435 0 1 1 9.994 8.02m7.246-.548v-1.36a2.77 2.77 0 0 0-2.768-2.768 2.77 2.77 0 0 0-2.769 2.768v1.36zm-2.718-4.424V2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle cx={13.449} cy={5.846} fill="currentColor" r={0.444} />
    <circle cx={15.652} cy={5.846} fill="currentColor" r={0.444} />
  </svg>
);
Automated.displayName = 'Automated';
