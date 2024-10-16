import Showdown from 'showdown';
import TurndownService from 'turndown';

export const MarkdownToHTMLConverter = new Showdown.Converter({
    strikethrough: true,
    tables: true,
    tasklists: true,
    simpleLineBreaks: true,
});

export const HTMLToMarkdown = new TurndownService({
    bulletListMarker: '-',
    fence: '```',
    codeBlockStyle: 'fenced',
})
    .addRule('codeblock', {
        filter: ['pre'],
        replacement: function (content: string) {
            return '```\n' + content + '\n```';
        },
    })
    .addRule('strikethrough', {
        filter: ['del', 's'],
        replacement: function (content: string) {
            return '~~' + content + '~~';
        },
    });