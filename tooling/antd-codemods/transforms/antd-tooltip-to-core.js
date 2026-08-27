'use strict';

/**
 * Converts antd `Tooltip` to the core `Tooltip` from
 * `@openmetadata/ui-core-components`.
 *
 * jscodeshift -t antd-tooltip-to-core.js <path> --parser=tsx
 *
 * The prop shapes line up closely — both take `title` and `placement`, and
 * core wraps its children in a react-aria `TooltipTrigger` internally, so the
 * `<Tooltip><Child/></Tooltip>` structure carries over unchanged.
 *
 * The catch is the child. antd attaches its tooltip to anything; react-aria
 * needs a focusable child that forwards props and a ref. A core `Button`
 * qualifies. A bare antd icon (`<InfoCircleOutlined />`, a plain `<span>`)
 * does not — converting one yields a tooltip that never opens, with no error
 * and no failing test. So conversion is limited to children that are known
 * valid triggers, and everything else is reported for hand-finishing.
 */

const CORE_MODULE = '@openmetadata/ui-core-components';
const ANTD_MODULE = 'antd';

// Children that are react-aria focusable triggers.
const VALID_TRIGGERS = new Set(['Button', 'ButtonUtility', 'TooltipTrigger']);

// antd uses a camelCase placement vocabulary; react-aria uses
// space-separated pairs. An unrecognised value is not an error - react-aria
// silently falls back to the default placement - so these must be translated
// rather than passed through.
const PLACEMENT_MAP = {
  top: 'top',
  bottom: 'bottom',
  left: 'left',
  right: 'right',
  topLeft: 'top left',
  topRight: 'top right',
  bottomLeft: 'bottom left',
  bottomRight: 'bottom right',
  leftTop: 'left top',
  leftBottom: 'left bottom',
  rightTop: 'right top',
  rightBottom: 'right bottom',
};

// antd props with no core equivalent; presence means hand-finish.
// antd keeps a tooltip's DOM mounted after it hides unless told otherwise;
// `destroyTooltipOnHide` opts into unmounting. react-aria renders no tooltip at
// all while closed, so the prop is already the default there and carries no
// behavior - drop it rather than forward an unknown prop to the DOM.
const DROPPED_PROPS = new Set(['destroyTooltipOnHide']);

// antd's overlay components open by cloning their immediate child and
// injecting an `onClick` and a ref into it. antd's own Tooltip forwards those
// on to *its* child, so `Popover > Tooltip > Button` works. Core's Tooltip
// does not forward them - unrecognised props land on the tooltip popup rather
// than the trigger - so converting a Tooltip nested directly inside one of
// these leaves the outer overlay unable to open, with no error.
const ANTD_INJECTING_PARENTS = new Set(['Popover', 'Dropdown', 'Tooltip']);

const UNSUPPORTED = [
  'overlay',
  'overlayStyle',
  'overlayClassName',
  'getPopupContainer',
  'open',
  'visible',
];

module.exports = function transform(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  const skips = [];

  const antdImport = root
    .find(j.ImportDeclaration, { source: { value: ANTD_MODULE } })
    .paths()[0];
  if (!antdImport) {
    return fileInfo.source;
  }

  const spec = antdImport.node.specifiers.find(
    (s) => s.type === 'ImportSpecifier' && s.imported.name === 'Tooltip'
  );
  if (!spec) {
    return fileInfo.source;
  }
  const localName = spec.local.name;

  // A child only counts as a valid trigger if it comes from core. Matching on
  // the name alone is not enough: a file can still import `Button` from antd,
  // and an antd Button wrapped in react-aria's TooltipTrigger produces a
  // tooltip that never opens - no error, no failing test.
  const coreLocalNames = new Set();
  root
    .find(j.ImportDeclaration, { source: { value: CORE_MODULE } })
    .forEach((pth) => {
      (pth.node.specifiers || []).forEach((sp) => {
        if (sp.type === 'ImportSpecifier' && VALID_TRIGGERS.has(sp.imported.name)) {
          coreLocalNames.add(sp.local.name);
        }
      });
    });

  // Local names of everything this file pulls in from antd, so an overlay
  // parent is only treated as antd's when it actually came from there.
  const antdLocalNames = new Set(
    (antdImport.node.specifiers || [])
      .filter((sp) => sp.type === 'ImportSpecifier')
      .map((sp) => sp.local.name)
  );

  let converted = 0;

  root
    .find(j.JSXElement, {
      openingElement: { name: { type: 'JSXIdentifier', name: localName } },
    })
    .forEach((path) => {
      const node = path.node;
      const attrs = node.openingElement.attributes || [];

      if (attrs.some((a) => a.type === 'JSXSpreadAttribute')) {
        skips.push('Tooltip(spread)');

        return;
      }

      const bad = attrs.find(
        (a) =>
          a.type === 'JSXAttribute' && UNSUPPORTED.includes(a.name && a.name.name)
      );
      if (bad) {
        skips.push(`Tooltip(${bad.name.name})`);

        return;
      }

      // The child has to be a valid react-aria trigger.
      const elementChildren = (node.children || []).filter(
        (c) =>
          c.type === 'JSXElement' ||
          (c.type === 'JSXExpressionContainer' &&
            c.expression.type !== 'JSXEmptyExpression')
      );
      if (elementChildren.length !== 1) {
        skips.push('Tooltip(child-not-single-element)');

        return;
      }
      const child = elementChildren[0];
      if (child.type !== 'JSXElement') {
        skips.push('Tooltip(child-dynamic)');

        return;
      }
      const childName =
        child.openingElement.name.type === 'JSXIdentifier'
          ? child.openingElement.name.name
          : null;
      if (!childName || !coreLocalNames.has(childName)) {
        skips.push(
          `Tooltip(child-not-a-core-trigger:${childName || 'unknown'})`
        );

        return;
      }

      const parentEl = path.parent && path.parent.node;
      if (
        parentEl &&
        parentEl.type === 'JSXElement' &&
        parentEl.openingElement.name.type === 'JSXIdentifier' &&
        ANTD_INJECTING_PARENTS.has(parentEl.openingElement.name.name) &&
        antdLocalNames.has(parentEl.openingElement.name.name)
      ) {
        skips.push(
          `Tooltip(inside-antd-${parentEl.openingElement.name.name})`
        );

        return;
      }

      // Core always renders the tooltip bubble, so a Tooltip with no title
      // shows an empty one on hover. antd renders nothing in that case, so
      // such a wrapper is usually dead weight that should be deleted rather
      // than converted.
      const hasTitle = attrs.some(
        (a) => a.type === 'JSXAttribute' && a.name && a.name.name === 'title'
      );
      if (!hasTitle) {
        skips.push('Tooltip(no-title)');

        return;
      }

      for (let i = attrs.length - 1; i >= 0; i--) {
        const a = attrs[i];
        if (a.type === 'JSXAttribute' && a.name && DROPPED_PROPS.has(a.name.name)) {
          attrs.splice(i, 1);
        }
      }

      // Translate the placement vocabulary before accepting the element.
      const placementAttr = attrs.find(
        (a) => a.type === 'JSXAttribute' && a.name && a.name.name === 'placement'
      );
      if (placementAttr) {
        const v = placementAttr.value;
        const raw =
          v && (v.type === 'StringLiteral' || v.type === 'Literal')
            ? v.value
            : undefined;
        if (raw === undefined) {
          skips.push('Tooltip(placement-dynamic)');

          return;
        }
        const mapped = PLACEMENT_MAP[raw];
        if (!mapped) {
          skips.push(`Tooltip(placement-unmapped:${raw})`);

          return;
        }
        placementAttr.value = j.stringLiteral(mapped);
      }

      converted += 1;
    });

  if (!converted) {
    if (skips.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[antd-tooltip-to-core] ${fileInfo.path}: needs hand-finish -> ${skips.join(', ')}`
      );
    }

    return fileInfo.source;
  }

  // Every remaining antd Tooltip in the file was skipped, so keep the import.
  const anySkipped = skips.length > 0;
  if (!anySkipped) {
    antdImport.node.specifiers = antdImport.node.specifiers.filter(
      (s) => !(s.type === 'ImportSpecifier' && s.imported.name === 'Tooltip')
    );
    if (!antdImport.node.specifiers.length) {
      j(antdImport).remove();
    }
  }

  const coreImport = root
    .find(j.ImportDeclaration, { source: { value: CORE_MODULE } })
    .paths()[0];
  if (coreImport) {
    const existing = new Set(
      coreImport.node.specifiers.map((s) => s.imported && s.imported.name)
    );
    if (!existing.has('Tooltip')) {
      coreImport.node.specifiers.push(
        j.importSpecifier(j.identifier('Tooltip'))
      );
    }
  } else {
    const decl = j.importDeclaration(
      [j.importSpecifier(j.identifier('Tooltip'))],
      j.stringLiteral(CORE_MODULE)
    );
    const imports = root.find(j.ImportDeclaration);
    if (imports.size()) {
      imports.at(0).insertBefore(decl);
    } else {
      root.get().node.program.body.unshift(decl);
    }
  }

  if (skips.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[antd-tooltip-to-core] ${fileInfo.path}: needs hand-finish -> ${skips.join(', ')}`
    );
  }

  return root.toSource({ quote: 'single' });
};

module.exports.parser = 'tsx';
