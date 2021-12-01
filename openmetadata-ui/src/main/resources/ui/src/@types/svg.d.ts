/*
 *  Copyright 2021 Collate
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

type SvgComponent = React.FunctionComponent<React.SVGAttributes<SVGElement>>;

// Module declaration to allow importing SVG files
declare module '*.svg' {
  const ReactComponent: SvgComponent;
  const path: string; // Fix it with url-loader

  export { ReactComponent };
  export default path;
}
