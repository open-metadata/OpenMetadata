'use strict';

/**
 * Moves named import specifiers from one module to another.
 *
 * jscodeshift -t transforms/move-named-imports.js <path> --parser=tsx \
 *   --names=Divider,Tag --from=antd --to=@openmetadata/ui-core-components
 */

// `path.node.importKind` is 'type' for `import type { ... } from '...'` and
// undefined/'value' for a regular value import. Treat undefined as 'value'
// so callers don't have to special-case the plain-JS case.
function importKindOf(node) {
  return node.importKind === 'type' ? 'type' : 'value';
}

module.exports = function transformer(file, api, options) {
  const j = api.jscodeshift;
  const root = j(file.source);
  const names = String(options.names || '').split(',').filter(Boolean);
  const from = options.from || 'antd';
  const to = options.to;
  if (!names.length || !to) {
    throw new Error('--names=<A,B> and --to=<module> are required');
  }

  const fromImports = root.find(j.ImportDeclaration, { source: { value: from } });
  if (!fromImports.size()) {
    return file.source;
  }

  // Process value imports and type-only imports independently so a
  // specifier is never moved across kinds: a new declaration created from a
  // type-only source stays `import type`, and it is only ever merged into an
  // existing target declaration of the *same* kind. Filtering re-checks each
  // path's current node, so a declaration already handled by one pass (e.g.
  // replaced in place) is correctly skipped by the other.
  ['type', 'value'].forEach((kind) => {
    const fromImportsOfKind = fromImports.filter(
      (path) => importKindOf(path.node) === kind
    );
    if (!fromImportsOfKind.size()) {
      return;
    }

    let moved = [];
    fromImportsOfKind.forEach((path) => {
      const keep = [];
      const movedHere = [];
      for (const spec of path.node.specifiers) {
        const isListed =
          spec.type === 'ImportSpecifier' && names.includes(spec.imported.name);
        (isListed ? movedHere : keep).push(spec);
      }
      if (!movedHere.length) {
        return;
      }
      moved.push(...movedHere);

      if (keep.length) {
        path.node.specifiers = keep;
        return;
      }

      // Replace in place (not remove+unshift) so leading comments — the
      // license header — stay attached to the top of the file.
      const target = root
        .find(j.ImportDeclaration, { source: { value: to } })
        .filter((p) => importKindOf(p.node) === kind);
      if (!target.size()) {
        const decl = j.importDeclaration(moved.slice(), j.literal(to));
        decl.importKind = kind;
        decl.comments = path.node.comments;
        j(path).replaceWith(decl);
        moved = [];
      } else {
        // Merging into an existing target import removes this node
        // entirely. If it was the program's first statement, its leading
        // comments are the file's license header — re-attach them to the
        // new first statement so the header stays at the top. Comments on
        // a non-first import (e.g. an eslint-disable aimed at the antd
        // line) are dropped with the import; re-homing them onto an
        // unrelated statement would be worse.
        const wasFirstStatement =
          root.get().node.program.body[0] === path.node;
        const leadingComments = path.node.comments;
        j(path).remove();
        if (wasFirstStatement && leadingComments && leadingComments.length) {
          const [firstStatement] = root.get().node.program.body;
          if (firstStatement) {
            firstStatement.comments = [
              ...leadingComments,
              ...(firstStatement.comments || []),
            ];
          }
        }
      }
    });

    if (moved.length) {
      const target = root
        .find(j.ImportDeclaration, { source: { value: to } })
        .filter((p) => importKindOf(p.node) === kind);
      if (target.size()) {
        target.at(0).get().node.specifiers.push(...moved);
      } else {
        const decl = j.importDeclaration(moved, j.literal(to));
        decl.importKind = kind;
        fromImportsOfKind.at(0).insertAfter(decl);
      }
    }
  });

  return root.toSource({ quote: 'single' });
};

module.exports.parser = 'tsx';
