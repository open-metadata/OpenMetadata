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
