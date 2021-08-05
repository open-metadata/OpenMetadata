import { EditorState, Modifier } from 'draft-js';
import PropTypes from 'prop-types';
import React, { Component } from 'react';

const getSelectedText = (editorState) => {
  const selection = editorState.getSelection();
  const anchorKey = selection.getAnchorKey();
  const currentContent = editorState.getCurrentContent();
  const currentBlock = currentContent.getBlockForKey(anchorKey);

  const start = selection.getStartOffset();
  const end = selection.getEndOffset();
  const selectedText = currentBlock.getText().slice(start, end);

  return selectedText;
};

export class Bold extends Component {
  static propTypes = {
    onChange: PropTypes.func,
    editorState: PropTypes.object,
  };

  makeBold = () => {
    const { editorState, onChange } = this.props;
    const selectedText = getSelectedText(editorState);

    const contentState = Modifier.replaceText(
      editorState.getCurrentContent(),
      editorState.getSelection(),
      `${
        selectedText.startsWith('**') && selectedText.endsWith('**')
          ? selectedText.replaceAll('**', '')
          : `**${selectedText}**`
      }`,
      editorState.getCurrentInlineStyle()
    );
    onChange(EditorState.push(editorState, contentState, 'insert-characters'));
  };

  render() {
    return (
      <div className="rdw-option-wrapper tw-font-bold" onClick={this.makeBold}>
        B
      </div>
    );
  }
}

export class Link extends Component {
  static propTypes = {
    onChange: PropTypes.func,
    editorState: PropTypes.object,
  };

  makeLink = () => {
    const { editorState, onChange } = this.props;

    const selectedText = getSelectedText(editorState);

    const contentState = Modifier.replaceText(
      editorState.getCurrentContent(),
      editorState.getSelection(),
      `${
        selectedText.startsWith('[') && selectedText.endsWith(')')
          ? selectedText.replace(/[\])}[{(]/g, '')
          : `[${selectedText}]()`
      }`,
      editorState.getCurrentInlineStyle()
    );
    onChange(EditorState.push(editorState, contentState, 'insert-characters'));
  };

  render() {
    return (
      <div className="rdw-option-wrapper " onClick={this.makeLink}>
        <i className="fas fa-link" />
      </div>
    );
  }
}

export class Italic extends Component {
  static propTypes = {
    onChange: PropTypes.func,
    editorState: PropTypes.object,
  };

  makeItalic = () => {
    const { editorState, onChange } = this.props;
    const selectedText = getSelectedText(editorState);

    const contentState = Modifier.replaceText(
      editorState.getCurrentContent(),
      editorState.getSelection(),
      `${
        selectedText.startsWith('_') && selectedText.endsWith('_')
          ? selectedText.replaceAll('_', '')
          : `_${selectedText}_`
      }`,
      editorState.getCurrentInlineStyle()
    );
    onChange(EditorState.push(editorState, contentState, 'insert-characters'));
  };

  render() {
    return (
      <div className="rdw-option-wrapper " onClick={this.makeItalic}>
        <i className="fas fa-italic" />
      </div>
    );
  }
}
