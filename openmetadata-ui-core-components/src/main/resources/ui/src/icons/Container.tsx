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

export const Container: FC<Props> = ({
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
      d="M3.97 8.67V5.738c0-.168 0-.252.033-.316a.3.3 0 0 1 .132-.131c.064-.033.148-.033.316-.033H15.49c.168 0 .252 0 .316.033a.3.3 0 0 1 .13.13c.034.065.034.149.034.317V8.67c0 2.54 0 3.81-.781 4.598-.781.789-2.038.789-4.552.789H9.304c-2.514 0-3.771 0-4.552-.789S3.97 11.209 3.97 8.67m0-3.416.578-1.23c.447-.955.67-1.432 1.124-1.7.453-.27 1.035-.27 2.198-.27h4.2c1.163 0 1.745 0 2.198.27.454.268.677.745 1.125 1.7l.576 1.23M8.77 7.656h2.4m-7.6 10.399h6.4m0 0h6.4m-6.4 0v-2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Container.displayName = 'Container';
