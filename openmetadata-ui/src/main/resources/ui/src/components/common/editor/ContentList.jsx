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

import classNames from 'classnames';
import propTypes, { arrayOf } from 'prop-types';
import React from 'react';
import placeholder from '../../../assets/img/user-placeholder.png';

const ContentList = React.forwardRef((props, ref) => {
  const { contentList, index, showImage, onItemSelect, className } = props;

  return (
    <ul
      className={classNames('editor-list-container', className || null)}
      ref={ref}>
      {contentList.map((listItem, i) => (
        <li
          className={'editor-list-item ' + (i === index ? 'selected' : '')}
          key={i}
          onMouseDown={() => {
            onItemSelect && onItemSelect(i);
          }}>
          {showImage && (
            <img alt="user" className="tw-inline" src={placeholder} />
          )}
          {listItem}
        </li>
      ))}
    </ul>
  );
});

ContentList.propTypes = {
  contentList: arrayOf(propTypes.string),
  index: propTypes.number,
  showImage: propTypes.bool,
  onItemSelect: propTypes.func,
  className: propTypes.string,
};

ContentList.displayName = 'ContentList';

export default ContentList;
