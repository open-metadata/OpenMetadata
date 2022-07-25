import MarkdownIcon from '../../../assets/svg/markdown.svg';

/**
 * Read more : https://nhn.github.io/tui.editor/latest/tutorial-example15-customizing-toolbar-buttons
 * @returns HTMLElement for toolbar
 */
const markdownButton = (): HTMLButtonElement => {
  const button = document.createElement('button');

  button.className = 'toastui-editor-toolbar-icons markdown-icon';
  button.style.backgroundImage = 'none';
  button.style.margin = '0';
  button.style.marginTop = '4px';
  button.innerHTML = `
  <a
    href="https://www.markdownguide.org/cheat-sheet/"
    rel="noreferrer"
    target="_blank">
    <img
      alt="markdown-icon"
      className="svg-icon"
      src=${MarkdownIcon} />
  </a>`;

  return button;
};

export const EDITOR_TOOLBAR_ITEMS = [
  'heading',
  'bold',
  'italic',
  'strike',
  'ul',
  'ol',
  'link',
  'hr',
  'quote',
  'code',
  'codeblock',
  {
    name: 'Markdown Guide',
    el: markdownButton(),
    tooltip: 'Markdown Guide',
  },
];
