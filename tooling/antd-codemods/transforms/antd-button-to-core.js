'use strict';

/**
 * Converts antd `Button` (and flags `Button.Group` / the
 * `antd/{es,lib}/button/button-group` subpath) to the core `Button` from
 * `@openmetadata/ui-core-components`.
 *
 * jscodeshift -t transforms/antd-button-to-core.js <path> --parser=tsx
 *
 * See README.md for the full mapping table and the list of constructs this
 * transform deliberately leaves untouched for hand-finishing. Mirrors the
 * structure and conventions of transforms/antd-typography-to-core.js.
 */

const CORE_MODULE = '@openmetadata/ui-core-components';
const ANTD_MODULE = 'antd';
const CORE_LOCAL_ALIAS = 'CoreButton';

// Approved 2026-07-30 (see docs/antd-migration/button.md).
const SIZE_MAP = { small: 'xs', middle: 'sm', large: 'md' };

// antd `type` (visual variant) -> core `color`, non-destructive.
const BASE_COLOR_MAP = {
  primary: 'primary',
  default: 'secondary',
  text: 'tertiary',
  link: 'link-gray',
};

// antd `type` + `danger` -> core `color`, destructive variant.
const DESTRUCTIVE_COLOR_MAP = {
  primary: 'primary-destructive',
  default: 'secondary-destructive',
  text: 'tertiary-destructive',
  link: 'link-destructive',
};

const SUBPATH_IMPORT_RE = /^antd\/(?:es|lib)\/button\/button-group$/;

// Reads the resolved literal value of a JSX attribute, distinguishing a
// present-but-dynamic value from a present-and-literal one so callers can
// tell "safe to convert" apart from "must skip and hand-finish".
function readAttrLiteral(attr) {
  if (!attr) {
    return { present: false };
  }
  if (attr.value == null) {
    // `<Button danger />` — implicit `true`.
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

  // -- Locate the antd `Button` named import (if any). --
  let buttonLocalName = null;
  let buttonImportPath = null;
  root
    .find(j.ImportDeclaration, { source: { value: ANTD_MODULE } })
    .forEach((path) => {
      path.node.specifiers.forEach((spec) => {
        if (spec.type === 'ImportSpecifier' && spec.imported.name === 'Button') {
          buttonLocalName = spec.local.name;
          buttonImportPath = path;
        }
      });
    });

  // -- Locate the legacy `antd/{es,lib}/button/button-group` subpath default
  // import (if any). Never touched beyond warning when its elements skip. --
  let subpathLocalName = null;
  root.find(j.ImportDeclaration).forEach((path) => {
    if (typeof path.node.source.value !== 'string') {
      return;
    }
    if (!SUBPATH_IMPORT_RE.test(path.node.source.value)) {
      return;
    }
    path.node.specifiers.forEach((spec) => {
      if (spec.type === 'ImportDefaultSpecifier' && spec.local) {
        subpathLocalName = spec.local.name;
      }
    });
  });

  if (!buttonLocalName && !subpathLocalName) {
    return file.source;
  }

  function classifyElement(node) {
    const name = node.openingElement.name;
    if (
      buttonLocalName &&
      name.type === 'JSXMemberExpression' &&
      name.object.type === 'JSXIdentifier' &&
      name.object.name === buttonLocalName
    ) {
      if (name.property.name === 'Group') {
        return { kind: 'ButtonGroup', matchType: 'member-group' };
      }
      return null;
    }
    if (name.type === 'JSXIdentifier') {
      if (buttonLocalName && name.name === buttonLocalName) {
        return { kind: 'Button', matchType: 'direct' };
      }
      if (subpathLocalName && name.name === subpathLocalName) {
        return { kind: 'ButtonGroupSubpath', matchType: 'subpath' };
      }
    }
    return null;
  }

  function renameAttr(attr, newName) {
    if (attr.value == null) {
      return j.jsxAttribute(j.jsxIdentifier(newName));
    }
    // Rebuild string-literal values fresh so recast re-emits them with the
    // configured quote style, rather than reusing the original (possibly
    // double-quoted) node verbatim.
    if (attr.value.type === 'StringLiteral' || attr.value.type === 'Literal') {
      return j.jsxAttribute(j.jsxIdentifier(newName), j.stringLiteral(attr.value.value));
    }
    return j.jsxAttribute(j.jsxIdentifier(newName), attr.value);
  }

  // Attempts to convert a single `<Button>` element in place. Returns
  // `{ skip: false, warnings: [...] }` on success (attributes already
  // rewritten) or `{ skip: true, reason }` if the element must stay
  // untouched.
  function convertElement(elNode) {
    const opening = elNode.openingElement;
    const attrs = opening.attributes;

    // No core equivalent for any `shape` value in current usage
    // (circle/round) — always hand-finish.
    if (findAttr(attrs, 'shape')) {
      return { skip: true, reason: 'shape-unsupported' };
    }

    const ghostAttr = findAttr(attrs, 'ghost');
    let ghostApplies = false;
    if (ghostAttr) {
      const lit = readAttrLiteral(ghostAttr);
      if (!lit.isLiteral || typeof lit.value !== 'boolean') {
        return { skip: true, reason: 'dynamic-ghost' };
      }
      ghostApplies = lit.value === true;
    }

    const typeAttr = findAttr(attrs, 'type');
    let typeValue = null;
    if (typeAttr) {
      const lit = readAttrLiteral(typeAttr);
      if (!lit.isLiteral || typeof lit.value !== 'string') {
        return { skip: true, reason: 'dynamic-type' };
      }
      if (lit.value === 'ghost') {
        ghostApplies = true;
      } else if (!BASE_COLOR_MAP[lit.value]) {
        return { skip: true, reason: 'unsupported-type' };
      } else {
        typeValue = lit.value;
      }
    }

    const dangerAttr = findAttr(attrs, 'danger');
    let dangerApplies = false;
    if (dangerAttr) {
      const lit = readAttrLiteral(dangerAttr);
      if (!lit.isLiteral || typeof lit.value !== 'boolean') {
        return { skip: true, reason: 'dynamic-danger' };
      }
      dangerApplies = lit.value === true;
    }

    const sizeAttr = findAttr(attrs, 'size');
    let sizeValue = null;
    if (sizeAttr) {
      const lit = readAttrLiteral(sizeAttr);
      if (!lit.isLiteral || typeof lit.value !== 'string') {
        return { skip: true, reason: 'dynamic-size' };
      }
      if (!SIZE_MAP[lit.value]) {
        return { skip: true, reason: 'unsupported-size' };
      }
      sizeValue = SIZE_MAP[lit.value];
    }

    const loadingAttr = findAttr(attrs, 'loading');
    if (
      loadingAttr &&
      loadingAttr.value &&
      loadingAttr.value.type === 'JSXExpressionContainer' &&
      loadingAttr.value.expression.type === 'ObjectExpression'
    ) {
      // `loading={{ delay }}` debounce form — unused in practice, but no
      // core equivalent, so hand-finish rather than guess.
      return { skip: true, reason: 'loading-object' };
    }

    const blockAttr = findAttr(attrs, 'block');
    const classNameAttr = findAttr(attrs, 'className');
    if (blockAttr && classNameAttr) {
      const isPlainString =
        classNameAttr.value &&
        (classNameAttr.value.type === 'StringLiteral' ||
          classNameAttr.value.type === 'Literal');
      if (!isPlainString) {
        return { skip: true, reason: 'dynamic-classname' };
      }
    }

    // -- All checks passed — compute the resolved `color`. --
    const warnings = [];
    let color;
    if (ghostApplies) {
      color = 'tertiary';
      warnings.push('ghost-remap');
    } else {
      const baseType = typeValue || 'default';
      color = dangerApplies
        ? DESTRUCTIVE_COLOR_MAP[baseType]
        : BASE_COLOR_MAP[baseType];
    }

    const disabledAttr = findAttr(attrs, 'disabled');
    const htmlTypeAttr = findAttr(attrs, 'htmlType');
    const iconAttr = findAttr(attrs, 'icon');

    const EXCLUDE = new Set([
      'type',
      'danger',
      'ghost',
      'size',
      'disabled',
      'loading',
      'htmlType',
      'icon',
      'block',
    ]);
    if (blockAttr) {
      EXCLUDE.add('className');
    }

    const newAttrs = [];
    attrs.forEach((attr) => {
      if (attr.type !== 'JSXAttribute') {
        newAttrs.push(attr); // JSXSpreadAttribute — pass through
        return;
      }
      if (EXCLUDE.has(attr.name.name)) {
        return; // handled below
      }
      newAttrs.push(attr);
    });

    newAttrs.push(j.jsxAttribute(j.jsxIdentifier('color'), j.stringLiteral(color)));
    if (sizeValue) {
      newAttrs.push(j.jsxAttribute(j.jsxIdentifier('size'), j.stringLiteral(sizeValue)));
    }
    if (disabledAttr) {
      newAttrs.push(renameAttr(disabledAttr, 'isDisabled'));
    }
    if (loadingAttr) {
      newAttrs.push(renameAttr(loadingAttr, 'isLoading'));
    }
    if (iconAttr) {
      newAttrs.push(renameAttr(iconAttr, 'iconLeading'));
    }
    // `htmlType` -> native `type`, processed *after* the visual `type` ->
    // `color` rewrite above so the two never collide on the same prop name.
    if (htmlTypeAttr) {
      newAttrs.push(renameAttr(htmlTypeAttr, 'type'));
    }
    if (blockAttr) {
      if (classNameAttr) {
        const merged = `${classNameAttr.value.value} tw:w-full`.trim();
        newAttrs.push(
          j.jsxAttribute(j.jsxIdentifier('className'), j.stringLiteral(merged))
        );
      } else {
        newAttrs.push(
          j.jsxAttribute(j.jsxIdentifier('className'), j.stringLiteral('tw:w-full'))
        );
      }
    }

    opening.attributes = newAttrs;
    return { skip: false, warnings };
  }

  const buttonSkips = []; // ties up the antd Button import; forces partial conversion
  const subpathSkips = []; // unrelated import; warn-only
  const conversionWarnings = [];
  const convertedElements = [];

  root.find(j.JSXElement).forEach((elPath) => {
    const classification = classifyElement(elPath.node);
    if (!classification) {
      return;
    }
    if (classification.kind === 'ButtonGroup') {
      buttonSkips.push({ kind: 'Button.Group', reason: 'button-group' });
      return;
    }
    if (classification.kind === 'ButtonGroupSubpath') {
      subpathSkips.push({ kind: 'ButtonGroup', reason: 'button-group-subpath' });
      return;
    }
    const result = convertElement(elPath.node);
    if (result.skip) {
      buttonSkips.push({ kind: 'Button', reason: result.reason });
      return;
    }
    convertedElements.push(elPath.node);
    result.warnings.forEach((reason) => conversionWarnings.push(reason));
  });

  if (buttonSkips.length || subpathSkips.length) {
    const summary = [...buttonSkips, ...subpathSkips]
      .map((s) => `${s.kind}(${s.reason})`)
      .join(', ');
    // eslint-disable-next-line no-console
    console.warn(
      `[antd-button-to-core] ${filePath}: needs hand-finish -> ${summary}`
    );
  }

  if (conversionWarnings.length) {
    const summary = conversionWarnings.join(', ');
    // eslint-disable-next-line no-console
    console.warn(
      `[antd-button-to-core] ${filePath}: converted-with-warnings -> ${summary}`
    );
  }

  if (!convertedElements.length) {
    return file.source;
  }

  const fullyConvertedFile = buttonSkips.length === 0;
  const finalCoreName = fullyConvertedFile ? 'Button' : CORE_LOCAL_ALIAS;

  convertedElements.forEach((node) => {
    node.openingElement.name = j.jsxIdentifier(finalCoreName);
    if (node.closingElement) {
      node.closingElement.name = j.jsxIdentifier(finalCoreName);
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
    const remainingSpecifiers = buttonImportPath.node.specifiers.filter(
      (spec) => !(spec.type === 'ImportSpecifier' && spec.imported.name === 'Button')
    );

    const hasCoreButtonAlready = coreImports
      .nodes()
      .some((n) =>
        n.specifiers.some(
          (s) =>
            s.type === 'ImportSpecifier' &&
            s.imported.name === 'Button' &&
            s.local.name === 'Button'
        )
      );

    if (remainingSpecifiers.length) {
      buttonImportPath.node.specifiers = remainingSpecifiers;
      if (!hasCoreButtonAlready) {
        if (coreImports.size()) {
          coreImports.at(0).get().node.specifiers.push(
            j.importSpecifier(j.identifier('Button'))
          );
        } else {
          const decl = j.importDeclaration(
            [j.importSpecifier(j.identifier('Button'))],
            j.literal(CORE_MODULE)
          );
          j(buttonImportPath).insertAfter(decl);
        }
      }
    } else if (!hasCoreButtonAlready && !coreImports.size()) {
      const decl = j.importDeclaration(
        [j.importSpecifier(j.identifier('Button'))],
        j.literal(CORE_MODULE)
      );
      replaceImportPreservingHeader(buttonImportPath, decl);
    } else {
      removeImportPreservingHeader(buttonImportPath);
      if (!hasCoreButtonAlready) {
        coreImports.at(0).get().node.specifiers.push(
          j.importSpecifier(j.identifier('Button'))
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
            s.imported.name === 'Button' &&
            s.local.name === CORE_LOCAL_ALIAS
        )
      );
    if (!hasAlias) {
      if (coreImports.size()) {
        coreImports.at(0).get().node.specifiers.push(
          j.importSpecifier(j.identifier('Button'), j.identifier(CORE_LOCAL_ALIAS))
        );
      } else {
        const decl = j.importDeclaration(
          [j.importSpecifier(j.identifier('Button'), j.identifier(CORE_LOCAL_ALIAS))],
          j.literal(CORE_MODULE)
        );
        j(buttonImportPath).insertAfter(decl);
      }
    }
  }

  return root.toSource({ quote: 'single' });
};

module.exports.parser = 'tsx';
module.exports.SIZE_MAP = SIZE_MAP;
module.exports.BASE_COLOR_MAP = BASE_COLOR_MAP;
module.exports.DESTRUCTIVE_COLOR_MAP = DESTRUCTIVE_COLOR_MAP;
