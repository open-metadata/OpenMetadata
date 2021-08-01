import propTypes from 'prop-types';
import React from 'react';
import { Button } from 'react-bootstrap';
import { useSlate } from 'slate-react';

const FormatButton = ({ format, icon, isFormatActive, toggleFormat }) => {
  const editor = useSlate();

  return (
    <Button
      size="sm"
      variant={isFormatActive(editor, format) ? 'secondary' : 'light'}
      onMouseDown={(event) => {
        event.preventDefault();
        toggleFormat(editor, format);
      }}>
      <i className={`fa fa-${icon}`} />
    </Button>
  );
};

FormatButton.propTypes = {
  format: propTypes.string,
  icon: propTypes.string,
  isFormatActive: propTypes.func,
  toggleFormat: propTypes.func,
};

export default FormatButton;
