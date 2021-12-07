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

import PropTypes from 'prop-types';
import React from 'react';
import { isEven } from '../../utils/CommonUtils';
import Tag from '../tags/tags';
import MiscDetails from './MiscDetails';

const Description = ({ description, miscDetails, tags }) => {
  const detailCount = miscDetails.length;

  return (
    <div data-testid="desc-container">
      <div
        className="tw-mb-1 tw-text-grey-body"
        dangerouslySetInnerHTML={{ __html: description }}
        data-testid="description"
      />

      {detailCount > 0 && (
        <p>
          {miscDetails.map((miscDetail, index) => {
            const { key, value } = miscDetail;

            return (
              <MiscDetails
                addSeparator={index !== detailCount - 1}
                key={index}
                text={value}
                title={key}
              />
            );
          })}
        </p>
      )}
      {tags && tags.length > 0 && (
        <div>
          <span>Tags: </span>
          {tags.map((tag, index) => (
            <Tag
              className={`tw-border-none  ${
                isEven(index + 1) ? 'tw-bg-gray-300' : 'tw-bg-gray-200'
              }`}
              key={index}
              tag={tag}
              type="contained"
            />
          ))}
        </div>
      )}
    </div>
  );
};

Description.defaultProps = {
  miscDetails: [],
};

Description.propTypes = {
  description: PropTypes.string.isRequired,
  miscDetails: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      value: PropTypes.string,
    })
  ),
  tags: PropTypes.array,
};

export default Description;
