/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import PropTypes from 'prop-types';
import React from 'react';
import { stringToSlug } from '../../utils/StringsUtils';

const TasksSidebar = ({ taskDetails }) => {
  const { description, tag } = taskDetails;

  return (
    <div className="tasks-row">
      <div>{description}</div>
      <div className={`task-tag ${stringToSlug(tag)}`}>{tag}</div>
    </div>
  );
};

TasksSidebar.propTypes = {
  taskDetails: PropTypes.shape({
    description: PropTypes.string,
    tag: PropTypes.string,
  }),
};

export default TasksSidebar;
