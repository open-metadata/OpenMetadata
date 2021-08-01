import propTypes from 'prop-types';
import React from 'react';

const Leaf = ({ attributes, children, leaf }) => {
  if (leaf.bold) {
    children = <strong>{children}</strong>;
  }

  if (leaf.code) {
    children = <code>{children}</code>;
  }

  if (leaf.italic) {
    children = <i>{children}</i>;
  }

  if (leaf.underline) {
    children = <u>{children}</u>;
  }

  if (leaf.strikethrough) {
    children = <strike>{children}</strike>;
  }

  return <span {...attributes}>{children}</span>;
};

Leaf.propTypes = {
  attributes: propTypes.object,
  children: propTypes.object,
  leaf: propTypes.shape({
    bold: propTypes.bool,
    code: propTypes.bool,
    italic: propTypes.bool,
    underline: propTypes.bool,
    strikethrough: propTypes.bool,
  }),
};

export default Leaf;
