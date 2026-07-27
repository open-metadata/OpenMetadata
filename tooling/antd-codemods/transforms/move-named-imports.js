'use strict';

/**
 * Moves named import specifiers from one module to another.
 *
 * jscodeshift -t transforms/move-named-imports.js <path> --parser=tsx \
 *   --names=Divider,Tag --from=antd --to=@openmetadata/ui-core-components
 */
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

  const moved = [];
  fromImports.forEach((path) => {
    const keep = [];
    for (const spec of path.node.specifiers) {
      const isListed =
        spec.type === 'ImportSpecifier' && names.includes(spec.imported.name);
      (isListed ? moved : keep).push(spec);
    }
    if (moved.length && keep.length) {
      path.node.specifiers = keep;
    }
    if (moved.length && !keep.length) {
      // Replace in place (not remove+unshift) so leading comments — the
      // license header — stay attached to the top of the file.
      const target = root.find(j.ImportDeclaration, { source: { value: to } });
      if (!target.size()) {
        const decl = j.importDeclaration(moved.slice(), j.literal(to));
        decl.comments = path.node.comments;
        j(path).replaceWith(decl);
        moved.length = 0;
      } else {
        j(path).remove();
      }
    }
  });

  if (moved.length) {
    const target = root.find(j.ImportDeclaration, { source: { value: to } });
    if (target.size()) {
      target.at(0).get().node.specifiers.push(...moved);
    } else {
      fromImports.at(0).insertAfter(j.importDeclaration(moved, j.literal(to)));
    }
  }

  return root.toSource({ quote: 'single' });
};
