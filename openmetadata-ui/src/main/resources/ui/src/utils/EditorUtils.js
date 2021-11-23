import escapeHtml from 'escape-html';
import { Editor, Range, Text, Transforms } from 'slate';
import { jsx } from 'slate-hyperscript';
import { ReactEditor } from 'slate-react';
import { LIST_TYPES } from '../constants/constants';

export const withMentions = (editor) => {
  const { isInline, isVoid } = editor;

  editor.isInline = (element) => {
    return element.type === 'mention' ? true : isInline(element);
  };

  editor.isVoid = (element) => {
    return element.type === 'mention' ? true : isVoid(element);
  };

  return editor;
};

export const withDatasets = (editor) => {
  const { isInline, isVoid } = editor;

  editor.isInline = (element) => {
    return element.type === 'dataset' ? true : isInline(element);
  };

  editor.isVoid = (element) => {
    return element.type === 'dataset' ? true : isVoid(element);
  };

  return editor;
};

export const focusAtEnd = (editor) => {
  ReactEditor.focus(editor);
  // setTimeout(() => {
  //   const { selection } = editor;
  //   const end = Range.edges(selection)[1];
  //   Transforms.setSelection(editor, {
  //     anchor: { offset: end.offset - 1, path: [end.path[0], end.path[1]] },
  //     focus: end,
  //   });
  // })
};

export const insertMention = (editor, character) => {
  let isOnlyMention = true;
  const { selection } = editor;
  const selectionText = Editor.string(editor, selection);
  if (selectionText !== '' && !selectionText.trim().startsWith('@')) {
    isOnlyMention = false;
    const end = Range.edges(selection)[1];
    Transforms.setSelection(editor, {
      anchor: { offset: end.offset - 1, path: [end.path[0], end.path[1]] },
      focus: end,
    });
  } else if (
    selection.anchor.path[0] !== selection.focus.path[0] &&
    selection.focus.offset === 1
  ) {
    const end = Range.edges(selection)[1];
    Transforms.setSelection(editor, {
      anchor: { offset: end.offset - 1, path: [end.path[0], end.path[1]] },
      focus: end,
    });
  }
  const mention = { type: 'mention', character, children: [{ text: ' ' }] };
  Transforms.insertNodes(editor, mention);
  if (isOnlyMention) {
    Transforms.move(editor);
    Transforms.insertText(editor, ' ');
  } else {
    Transforms.move(editor, { distance: 1, unit: 'word' });
  }
};

export const insertDataset = (editor, character) => {
  let isOnlyDataset = true;
  const { selection } = editor;
  const selectionText = Editor.string(editor, selection);
  if (selectionText !== '' && !selectionText.startsWith('#')) {
    isOnlyDataset = false;
    const end = Range.edges(selection)[1];
    Transforms.setSelection(editor, {
      anchor: { offset: end.offset - 1, path: [end.path[0], end.path[1]] },
      focus: end,
    });
  } else if (
    selection.anchor.path[0] !== selection.focus.path[0] &&
    selection.focus.offset === 1
  ) {
    const end = Range.edges(selection)[1];
    Transforms.setSelection(editor, {
      anchor: { offset: end.offset - 1, path: [end.path[0], end.path[1]] },
      focus: end,
    });
  }
  const dataset = { type: 'dataset', character, children: [{ text: '' }] };
  Transforms.insertNodes(editor, dataset);
  if (isOnlyDataset) {
    Transforms.move(editor);
  } else {
    Transforms.move(editor, { distance: 1, unit: 'word' });
  }
};

export const isBlockActive = (editor, format) => {
  const [match] = Editor.nodes(editor, {
    match: (n) => n.type === format,
  });

  return !!match;
};

export const toggleBlock = (editor, format) => {
  const isActive = isBlockActive(editor, format);
  const isList = LIST_TYPES.includes(format);

  Transforms.unwrapNodes(editor, {
    match: (n) => LIST_TYPES.includes(n.type),
    split: true,
  });

  Transforms.setNodes(editor, {
    type: isActive ? 'paragraph' : isList ? 'list-item' : format,
  });

  if (!isActive && isList) {
    const block = { type: format, children: [] };
    Transforms.wrapNodes(editor, block);
  }
};

export const isMarkActive = (editor, format) => {
  const marks = Editor.marks(editor);

  return marks ? marks[format] === true : false;
};

export const toggleMark = (editor, format) => {
  const isActive = isMarkActive(editor, format);

  if (isActive) {
    Editor.removeMark(editor, format);
  } else {
    Editor.addMark(editor, format, true);
  }
};

export const serializeData = (node) => {
  if (Text.isText(node)) {
    let text = escapeHtml(node.text);
    if (node.bold) {
      text = `<strong>${text}</strong>`;
    }
    if (node.italic) {
      text = `<i>${text}</i>`;
    }
    if (node.underline) {
      text = `<u>${text}</u>`;
    }
    if (node.strikethrough) {
      text = `<strike>${text}</strike>`;
    }
    if (node.code) {
      text = `<code class="editor-code">${text}</code>`;
    }

    return text;
  }

  const children =
    node.children.map((n) => serializeData(n)).join('') || '&#xFEFF;';

  switch (node.type) {
    case 'block-quote':
      return `<blockquote class="editor-blockquote">${children}</blockquote>`;
    case 'paragraph':
      return `<p>${children}</p>`;
    case 'numbered-list':
      return `<ol>${children}</ol>`;
    case 'bulleted-list':
      return `<ul>${children}</ul>`;
    case 'list-item':
      return `<li>${children}</li>`;
    case 'mention':
      return `<span class="content-element">@${node.character}</span>`;
    case 'dataset':
      return `<span class="content-element">#${node.character}</span>`;
    default:
      return children;
  }
};

export const deserializeData = (el) => {
  if (el.nodeType === 3) {
    return el.textContent;
  } else if (el.nodeType !== 1) {
    return null;
  }

  const children = Array.from(el.childNodes).map(deserializeData);

  switch (el.nodeName) {
    case 'BLOCKQUOTE':
      return jsx('element', { type: 'block-quote' }, children);
    case 'P':
      return jsx('element', { type: 'paragraph' }, children);
    case 'STRONG': {
      if (typeof children[0] === 'object') {
        children[0].bold = true;

        return children;
      } else {
        return { text: `${children}`, bold: true };
      }
    }
    case 'I': {
      if (typeof children[0] === 'object') {
        children[0].italic = true;

        return children;
      } else {
        return { text: `${children}`, italic: true };
      }
    }
    case 'U': {
      if (typeof children[0] === 'object') {
        children[0].underline = true;

        return children;
      } else {
        return { text: `${children}`, underline: true };
      }
    }
    case 'STRIKE': {
      if (typeof children[0] === 'object') {
        children[0].strikethrough = true;

        return children;
      } else {
        return { text: `${children}`, strikethrough: true };
      }
    }
    case 'CODE': {
      if (typeof children[0] === 'object') {
        children[0].code = true;

        return children;
      } else {
        return { text: `${children}`, code: true };
      }
    }
    case 'LI':
      return jsx('element', { type: 'list-item' }, children);
    case 'UL':
      return jsx('element', { type: 'bulleted-list' }, children);
    case 'OL':
      return jsx('element', { type: 'numbered-list' }, children);
    case 'SPAN': {
      if (children[0][0] === '@') {
        return {
          type: 'mention',
          character: children[0].substring(1),
          children: [{ text: ' ' }],
        };
      }
      if (children[0][0] === '#') {
        return {
          type: 'dataset',
          character: children[0].substring(1),
          children: [{ text: ' ' }],
        };
      }

      break;
    }
    case 'DIV': {
      if (typeof children[0] === 'object') {
        return children;
      } else {
        const baseElement = jsx('element', { type: 'paragraph' }, children);

        return [baseElement];
      }
    }
    default:
      return children;
  }
};
