/*
 *  Copyright 2026 Collate.
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

import classNames from 'classnames';
import { GlossaryTermPropertyDatatype } from '../../../../generated/type/glossaryTermProperty';
import { PROPERTY_TYPE_APPEARANCE } from '../../../../utils/governance/glossary/GlossaryTermProperties.constants';

interface GlossaryTermPropertyTypeTileProps {
  datatype: GlossaryTermPropertyDatatype;
  /** `md` fills the table and form rows; `sm` fits the type cards. */
  size?: 'sm' | 'md';
}

const GlossaryTermPropertyTypeTile = ({
  datatype,
  size = 'md',
}: GlossaryTermPropertyTypeTileProps) => {
  const {
    glyph,
    icon: Icon,
    tileClassName,
  } = PROPERTY_TYPE_APPEARANCE[datatype];

  return (
    <span
      aria-hidden
      className={classNames(
        'tw:flex tw:shrink-0 tw:items-center tw:justify-center tw:rounded-md tw:text-xs tw:font-bold',
        size === 'md' ? 'tw:size-8' : 'tw:size-6',
        tileClassName
      )}>
      {Icon ? (
        <Icon className={size === 'md' ? 'tw:size-4' : 'tw:size-3.5'} />
      ) : (
        glyph
      )}
    </span>
  );
};

export default GlossaryTermPropertyTypeTile;
