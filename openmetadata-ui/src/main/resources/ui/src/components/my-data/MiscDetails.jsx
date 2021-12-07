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

const DescriptionDetails = ({ title, text, addSeparator }) => {
  return (
    <span data-testid="misc-details">
      <span data-testid="title">{title} :</span>{' '}
      <span data-testid="text">{text}</span>{' '}
      {addSeparator && <span data-testid="separator">{' | '}</span>}
    </span>
  );
};

DescriptionDetails.defaultProps = {
  addSeparator: true,
};

DescriptionDetails.propTypes = {
  title: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
  addSeparator: PropTypes.bool,
};

export default DescriptionDetails;
