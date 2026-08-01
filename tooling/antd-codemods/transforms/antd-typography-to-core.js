'use strict';

/**
 * Converts antd `Typography` sub-components to the flat core `Typography`
 * component from `@openmetadata/ui-core-components`.
 *
 * jscodeshift -t transforms/antd-typography-to-core.js <path> --parser=tsx
 *
 * See README.md for the full mapping table, the approved `LEVEL_SIZE_MAP`
 * convention, and the list of constructs this transform deliberately
 * leaves untouched for hand-finishing.
 */

// Approved 2026-07-30 (tracked in the antd migration ledger): antd's
// `Typography.Title` `level` (1-5) has no size concept of its own, so this
// table is the convention used to pick a core `size` per level.
// Level 5 dominates real usage (>70% across repos) and maps to 'text-md',
// the closest visual match to antd's smallest heading variant.
const LEVEL_SIZE_MAP = {
  1: 'display-sm',
  2: 'display-xs',
  3: 'text-xl',
  4: 'text-lg',
  5: 'text-md',
};

const CORE_MODULE = '@openmetadata/ui-core-components';
const ANTD_MODULE = 'antd';
const CORE_LOCAL_ALIAS = 'CoreTypography';

const SUB_COMPONENT_KINDS = ['Text', 'Title', 'Paragraph', 'Link'];

// Props with no equivalent on core Typography at all. Any element using one
// of these is left completely untouched (still antd) and reported.
const UNSUPPORTED_PROP_NAMES = [
  'copyable',
  'editable',
  'code',
  'keyboard',
  'mark',
  'delete',
  'italic',
  'disabled',
];

// `ellipsis={{ ... }}` keys with no core equivalent (show-more/less UX).
const ELLIPSIS_UNSUPPORTED_KEYS = ['expandable', 'symbol', 'onExpand'];

// Sub-component -> the `as` value the core component needs (undefined means
// "no `as` attribute", i.e. the default `span`, which is Text's antd shape).
const KIND_TO_AS = {
  Text: undefined,
  Paragraph: 'p',
  Link: 'a',
};

const ALLOWED_TYPE_VALUES = ['secondary', 'success', 'warning', 'danger'];

function isObjectPropertyLike(node) {
  return node.type === 'ObjectProperty' || node.type === 'Property';
}

// Reads the resolved literal value of a JSX attribute, distinguishing a
// present-but-dynamic value from a present-and-literal one so callers can
// tell "safe to convert" apart from "must skip and hand-finish".
function readAttrLiteral(attr) {
  if (!attr) {
    return { present: false };
  }
  if (attr.value == null) {
    // `<Foo strong />` — implicit `true`.
    return { present: true, isLiteral: true, value: true };
  }
  if (attr.value.type === 'StringLiteral' || attr.value.type === 'Literal') {
    return { present: true, isLiteral: true, value: attr.value.value };
  }
  if (attr.value.type === 'JSXExpressionContainer') {
    const expr = attr.value.expression;
    if (
      expr.type === 'NumericLiteral' ||
      expr.type === 'BooleanLiteral' ||
      expr.type === 'StringLiteral' ||
      expr.type === 'Literal'
    ) {
      return { present: true, isLiteral: true, value: expr.value };
    }
    return { present: true, isLiteral: false, expression: expr };
  }
  return { present: true, isLiteral: false };
}

function findAttr(attributes, name) {
  return attributes.find(
    (attr) => attr.type === 'JSXAttribute' && attr.name.name === name
  );
}

module.exports = function transformer(file, api) {
  const j = api.jscodeshift;
  const filePath = (file && file.path) || '<unknown>';
  const root = j(typeof file === 'string' ? file : file.source);

  const antdImports = root.find(j.ImportDeclaration, {
    source: { value: ANTD_MODULE },
  });
  if (!antdImports.size()) {
    return file.source;
  }

  let typographyLocalName = null;
  let typographyImportPath = null;
  antdImports.forEach((path) => {
    path.node.specifiers.forEach((spec) => {
      if (
        spec.type === 'ImportSpecifier' &&
        spec.imported.name === 'Typography'
      ) {
        typographyLocalName = spec.local.name;
        typographyImportPath = path;
      }
    });
  });
  if (!typographyLocalName) {
    return file.source;
  }

  // Destructuring: `const { Text, Title: T } = Typography;`, anywhere in the
  // file (including inside jest mock factories) — track which local name
  // maps to which sub-component so bare `<Text>`/`<T>` JSX can be resolved.
  const destructurings = root
    .find(j.VariableDeclarator, {
      init: { type: 'Identifier', name: typographyLocalName },
    })
    .filter((path) => path.node.id.type === 'ObjectPattern');

  const localNameToKind = new Map();
  destructurings.forEach((path) => {
    path.node.id.properties.forEach((prop) => {
      if (!isObjectPropertyLike(prop) || !prop.key) {
        return;
      }
      const kind = prop.key.name;
      if (!SUB_COMPONENT_KINDS.includes(kind) || prop.value.type !== 'Identifier') {
        return;
      }
      localNameToKind.set(prop.value.name, kind);
    });
  });

  function classifyElement(node) {
    const name = node.openingElement.name;
    if (
      name.type === 'JSXMemberExpression' &&
      name.object.type === 'JSXIdentifier' &&
      name.object.name === typographyLocalName
    ) {
      if (SUB_COMPONENT_KINDS.includes(name.property.name)) {
        return { kind: name.property.name, matchType: 'member' };
      }
      return null;
    }
    if (name.type === 'JSXIdentifier') {
      if (name.name === typographyLocalName) {
        return { kind: 'Bare', matchType: 'bare' };
      }
      if (localNameToKind.has(name.name)) {
        return {
          kind: localNameToKind.get(name.name),
          matchType: 'destructured',
          localName: name.name,
        };
      }
    }
    return null;
  }

  // Attempts to convert a single element in place. Returns
  // `{ skip: false }` on success (attributes already rewritten) or
  // `{ skip: true, reason }` if the element must stay untouched.
  function convertElement(elNode, kind) {
    const opening = elNode.openingElement;
    const attrs = opening.attributes;

    const hasUnsupported = attrs.some(
      (attr) =>
        attr.type === 'JSXAttribute' &&
        UNSUPPORTED_PROP_NAMES.includes(attr.name.name)
    );
    if (hasUnsupported) {
      return { skip: true, reason: 'unsupported-prop' };
    }

    const ellipsisAttr = findAttr(attrs, 'ellipsis');
    if (
      ellipsisAttr &&
      ellipsisAttr.value &&
      ellipsisAttr.value.type === 'JSXExpressionContainer' &&
      ellipsisAttr.value.expression.type === 'ObjectExpression'
    ) {
      const hasBadKey = ellipsisAttr.value.expression.properties.some(
        (prop) => prop.key && ELLIPSIS_UNSUPPORTED_KEYS.includes(prop.key.name)
      );
      if (hasBadKey) {
        return { skip: true, reason: 'ellipsis-expandable' };
      }
    }

    let level = 1;
    if (kind === 'Title') {
      const levelAttr = findAttr(attrs, 'level');
      if (levelAttr) {
        const lit = readAttrLiteral(levelAttr);
        if (!lit.isLiteral || typeof lit.value !== 'number') {
          return { skip: true, reason: 'dynamic-title-level' };
        }
        level = lit.value;
      }
      if (!LEVEL_SIZE_MAP[level]) {
        return { skip: true, reason: 'unsupported-title-level' };
      }
    }

    const strongAttr = findAttr(attrs, 'strong');
    let strongResolved = null;
    if (strongAttr) {
      const lit = readAttrLiteral(strongAttr);
      if (!lit.isLiteral || typeof lit.value !== 'boolean') {
        return { skip: true, reason: 'dynamic-strong' };
      }
      strongResolved = lit.value;
    }

    const underlineAttr = findAttr(attrs, 'underline');
    let underlineResolved = null;
    if (underlineAttr) {
      const lit = readAttrLiteral(underlineAttr);
      if (!lit.isLiteral || typeof lit.value !== 'boolean') {
        return { skip: true, reason: 'dynamic-underline' };
      }
      underlineResolved = lit.value;
    }

    const classNameAttr = findAttr(attrs, 'className');
    if (underlineResolved && classNameAttr) {
      const isPlainString =
        classNameAttr.value &&
        (classNameAttr.value.type === 'StringLiteral' ||
          classNameAttr.value.type === 'Literal');
      if (!isPlainString) {
        return { skip: true, reason: 'dynamic-underline-classname' };
      }
    }

    const typeAttr = findAttr(attrs, 'type');
    let typeValue = null;
    if (typeAttr) {
      const lit = readAttrLiteral(typeAttr);
      if (
        !lit.isLiteral ||
        typeof lit.value !== 'string' ||
        !ALLOWED_TYPE_VALUES.includes(lit.value)
      ) {
        return { skip: true, reason: 'unsupported-type' };
      }
      typeValue = lit.value;
    }

    // All checks passed — perform the rewrite.
    const newAttrs = [];
    if (kind === 'Title') {
      newAttrs.push(j.jsxAttribute(j.jsxIdentifier('as'), j.stringLiteral(`h${level}`)));
      newAttrs.push(
        j.jsxAttribute(j.jsxIdentifier('size'), j.stringLiteral(LEVEL_SIZE_MAP[level]))
      );
    } else if (KIND_TO_AS[kind]) {
      newAttrs.push(
        j.jsxAttribute(j.jsxIdentifier('as'), j.stringLiteral(KIND_TO_AS[kind]))
      );
    }

    attrs.forEach((attr) => {
      if (attr.type !== 'JSXAttribute') {
        newAttrs.push(attr); // JSXSpreadAttribute — pass through
        return;
      }
      const name = attr.name.name;
      if (['level', 'strong', 'underline', 'type', 'className'].includes(name)) {
        return; // handled below
      }
      newAttrs.push(attr);
    });

    if (strongResolved === true) {
      newAttrs.push(j.jsxAttribute(j.jsxIdentifier('weight'), j.stringLiteral('bold')));
    }
    if (typeValue) {
      newAttrs.push(j.jsxAttribute(j.jsxIdentifier('color'), j.stringLiteral(typeValue)));
    }

    if (classNameAttr) {
      if (underlineResolved) {
        const merged = `${classNameAttr.value.value} tw:underline`.trim();
        newAttrs.push(
          j.jsxAttribute(j.jsxIdentifier('className'), j.stringLiteral(merged))
        );
      } else {
        newAttrs.push(classNameAttr);
      }
    } else if (underlineResolved) {
      newAttrs.push(
        j.jsxAttribute(j.jsxIdentifier('className'), j.stringLiteral('tw:underline'))
      );
    }

    opening.attributes = newAttrs;
    return { skip: false };
  }

  const skips = [];
  const convertedElements = [];
  let bareUsageFound = false;
  const destructuredUsage = new Map(); // localName -> { converted, skipped }

  function recordDestructuredUsage(localName, key) {
    const usage = destructuredUsage.get(localName) || { converted: 0, skipped: 0 };
    usage[key] += 1;
    destructuredUsage.set(localName, usage);
  }

  root.find(j.JSXElement).forEach((elPath) => {
    const classification = classifyElement(elPath.node);
    if (!classification) {
      return;
    }
    if (classification.matchType === 'bare') {
      bareUsageFound = true;
      return;
    }
    const result = convertElement(elPath.node, classification.kind);
    if (result.skip) {
      skips.push({ file: filePath, kind: classification.kind, reason: result.reason });
      if (classification.matchType === 'destructured') {
        recordDestructuredUsage(classification.localName, 'skipped');
      }
      return;
    }
    convertedElements.push(elPath.node);
    if (classification.matchType === 'destructured') {
      recordDestructuredUsage(classification.localName, 'converted');
    }
  });

  if (skips.length) {
    const summary = skips
      .map((s) => `${s.kind}(${s.reason})`)
      .join(', ');
    // eslint-disable-next-line no-console
    console.warn(
      `[antd-typography-to-core] ${filePath}: needs hand-finish -> ${summary}`
    );
  }

  if (!convertedElements.length) {
    return file.source;
  }

  const fullyConvertedFile = skips.length === 0 && !bareUsageFound;
  const finalCoreName = fullyConvertedFile ? 'Typography' : CORE_LOCAL_ALIAS;

  convertedElements.forEach((node) => {
    node.openingElement.name = j.jsxIdentifier(finalCoreName);
    if (node.closingElement) {
      node.closingElement.name = j.jsxIdentifier(finalCoreName);
    }
  });

  // Drop destructured properties that are now fully converted (no remaining
  // skipped usage still needs the antd-bound local name); remove the whole
  // declaration once its pattern is empty.
  destructurings.forEach((declaratorPath) => {
    const pattern = declaratorPath.node.id;
    pattern.properties = pattern.properties.filter((prop) => {
      if (!isObjectPropertyLike(prop) || !prop.key) {
        return true;
      }
      if (!SUB_COMPONENT_KINDS.includes(prop.key.name)) {
        return true;
      }
      const localName = prop.value.name;
      const usage = destructuredUsage.get(localName);
      if (!usage) {
        return true; // never referenced in JSX — leave alone
      }
      return usage.skipped > 0; // keep only if still needed by a skipped usage
    });

    if (pattern.properties.length === 0) {
      const declPath = j(declaratorPath).closest(j.VariableDeclaration);
      if (declPath.size()) {
        const declNode = declPath.get().node;
        if (declNode.declarations.length === 1) {
          declPath.remove();
        } else {
          declNode.declarations = declNode.declarations.filter(
            (d) => d !== declaratorPath.node
          );
        }
      }
    }
  });

  const coreImports = root.find(j.ImportDeclaration, {
    source: { value: CORE_MODULE },
  });

  function replaceImportPreservingHeader(path, newDecl) {
    newDecl.comments = path.node.comments;
    j(path).replaceWith(newDecl);
  }

  function removeImportPreservingHeader(path) {
    const wasFirstStatement = root.get().node.program.body[0] === path.node;
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

  if (fullyConvertedFile) {
    const remainingSpecifiers = typographyImportPath.node.specifiers.filter(
      (spec) =>
        !(spec.type === 'ImportSpecifier' && spec.imported.name === 'Typography')
    );

    const hasCoreTypographyAlready = coreImports
      .nodes()
      .some((n) =>
        n.specifiers.some(
          (s) =>
            s.type === 'ImportSpecifier' &&
            s.imported.name === 'Typography' &&
            s.local.name === 'Typography'
        )
      );

    if (remainingSpecifiers.length) {
      typographyImportPath.node.specifiers = remainingSpecifiers;
      if (!hasCoreTypographyAlready) {
        if (coreImports.size()) {
          coreImports.at(0).get().node.specifiers.push(
            j.importSpecifier(j.identifier('Typography'))
          );
        } else {
          const decl = j.importDeclaration(
            [j.importSpecifier(j.identifier('Typography'))],
            j.literal(CORE_MODULE)
          );
          j(typographyImportPath).insertAfter(decl);
        }
      }
    } else if (!hasCoreTypographyAlready && !coreImports.size()) {
      const decl = j.importDeclaration(
        [j.importSpecifier(j.identifier('Typography'))],
        j.literal(CORE_MODULE)
      );
      replaceImportPreservingHeader(typographyImportPath, decl);
    } else {
      removeImportPreservingHeader(typographyImportPath);
      if (!hasCoreTypographyAlready) {
        coreImports.at(0).get().node.specifiers.push(
          j.importSpecifier(j.identifier('Typography'))
        );
      }
    }
  } else {
    const hasAlias = coreImports
      .nodes()
      .some((n) =>
        n.specifiers.some(
          (s) =>
            s.type === 'ImportSpecifier' &&
            s.imported.name === 'Typography' &&
            s.local.name === CORE_LOCAL_ALIAS
        )
      );
    if (!hasAlias) {
      if (coreImports.size()) {
        coreImports.at(0).get().node.specifiers.push(
          j.importSpecifier(j.identifier('Typography'), j.identifier(CORE_LOCAL_ALIAS))
        );
      } else {
        const decl = j.importDeclaration(
          [j.importSpecifier(j.identifier('Typography'), j.identifier(CORE_LOCAL_ALIAS))],
          j.literal(CORE_MODULE)
        );
        j(typographyImportPath).insertAfter(decl);
      }
    }
  }

  return root.toSource({ quote: 'single' });
};

module.exports.parser = 'tsx';
module.exports.LEVEL_SIZE_MAP = LEVEL_SIZE_MAP;
