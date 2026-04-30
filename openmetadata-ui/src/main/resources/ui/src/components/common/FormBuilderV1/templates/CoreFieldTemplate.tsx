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

import { FieldTemplateProps } from '@rjsf/utils';

export const CoreFieldTemplate = ({
  children,
  classNames,
  hidden,
  style,
}: FieldTemplateProps) => {
  if (hidden) {
    return <div className="tw:hidden">{children}</div>;
  }

  return (
    <div className={classNames} style={style}>
      {children}
    </div>
  );
};
