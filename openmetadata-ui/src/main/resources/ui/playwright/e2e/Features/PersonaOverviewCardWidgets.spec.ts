/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { Locator, Page } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { DataProduct } from '../../support/domain/DataProduct';
import { expect, test as base } from '../../support/fixtures/base';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { AdminClass } from '../../support/user/AdminClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { scrollIntoViewAndSettle, toastNotification } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';

const overviewCardPersona = new PersonaClass();
const adminUser = new AdminClass();
const overviewCardUser = new UserClass();

const test = base.extend<{
  adminPage: Page;
  overviewCardUserPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.signIn(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
  overviewCardUserPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await overviewCardUser.signIn(page);
    await use(page);
    await page.close();
  },
});

test.beforeAll('Setup Overview card tests', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await overviewCardUser.create(apiContext);
  await overviewCardUser.setAdminRole(apiContext);

  await overviewCardPersona.create(apiContext);

  const overviewCardPersonaReference = {
    id: overviewCardPersona.responseData.id,
    name: overviewCardPersona.responseData.name,
    displayName: overviewCardPersona.responseData.displayName,
    fullyQualifiedName: overviewCardPersona.responseData.fullyQualifiedName,
    type: 'persona',
  };
  await overviewCardUser.patch({
    apiContext,
    patchData: [
      { op: 'add', path: '/personas/0', value: overviewCardPersonaReference },
      {
        op: 'add',
        path: '/defaultPersona',
        value: overviewCardPersonaReference,
      },
    ],
  });

  await afterAction();
});

test.afterAll('Cleanup Overview card tests', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await overviewCardUser.delete(apiContext);
  await overviewCardPersona.delete(apiContext);
  await afterAction();
});

const byId = (id: string) => `[id="${id}"]`;

const OVERVIEW_CARD = byId('KnowledgePanel.LeftPanel');

const getOverviewCardPersonaFqn = () =>
  overviewCardPersona.responseData.fullyQualifiedName ??
  overviewCardPersona.data.name;

const openCustomizePage = async (page: Page, pageType: string) => {
  const personaFqn = getOverviewCardPersonaFqn();
  // 404 until the persona's first layout is saved.
  const layoutResponse = waitForResponseWithStatus(
    page,
    (response) =>
      response.request().method() === 'GET' &&
      decodeURIComponent(new URL(response.url()).pathname).endsWith(
        `/docStore/name/persona.${personaFqn}`
      ),
    [200, 404]
  );
  await page.goto(
    `/customize-page/${encodeURIComponent(personaFqn)}/${pageType}`
  );
  await layoutResponse;
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('customize-tab-card')).toBeVisible();
  await expect(page.locator(OVERVIEW_CARD)).toBeVisible();
};

const savePageLayout = async (page: Page) => {
  // The first save creates the persona's layout document; later saves patch it.
  const saveResponse = waitForResponseWithStatus(
    page,
    (response) =>
      response.request().method() !== 'GET' &&
      /^\/api\/v1\/docStore(?:\/[^/]+)?$/.test(
        new URL(response.url()).pathname
      ),
    'ok'
  );
  await page.getByTestId('save-button').click();
  await saveResponse;
  await toastNotification(
    page,
    /^Page layout (created|updated) successfully\.$/
  );
};

const getBox = async (locator: Locator) => {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('Expected the element to have a bounding box');
  }

  return box;
};

// The drop point is a spot on the card, not an element: the dragged widget
// covers whatever is under the pointer, so locator.dragTo cannot target it.
// Callers scroll the card into view first, so the point is on screen and the
// hover does not scroll it away.
const dragToPoint = async (
  page: Page,
  handle: Locator,
  x: number,
  y: number
) => {
  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 10 });
  await page.mouse.up();
};

// Where a widget sits across the Overview card's six columns: the column it
// starts at and how many it spans, each rounded to the nearest sixth.
const getCardColumns = async (widget: Locator, card: Locator) => {
  const [widgetBox, cardBox] = await Promise.all([
    widget.boundingBox(),
    card.boundingBox(),
  ]);
  if (!widgetBox || !cardBox) {
    return null;
  }
  const toSixths = (width: number) => Math.round((width / cardBox.width) * 6);

  return {
    start: toSixths(widgetBox.x - cardBox.x),
    span: toSixths(widgetBox.width),
  };
};

const isBelow = async (lower: Locator, upper: Locator) => {
  const [lowerBox, upperBox] = await Promise.all([
    lower.boundingBox(),
    upper.boundingBox(),
  ]);

  return Boolean(
    lowerBox && upperBox && lowerBox.y >= upperBox.y + upperBox.height
  );
};

const isRightOf = async (right: Locator, left: Locator) => {
  const [rightBox, leftBox] = await Promise.all([
    right.boundingBox(),
    left.boundingBox(),
  ]);

  return Boolean(
    rightBox && leftBox && rightBox.x >= leftBox.x + leftBox.width
  );
};

test.describe('Persona Overview card', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  let dataProduct: DataProduct;

  test.beforeAll('Setup Overview card data product', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    dataProduct = new DataProduct();
    await dataProduct.create(apiContext);
    await afterAction();
  });

  test.afterAll('Cleanup Overview card data product', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await dataProduct.delete(apiContext);
    for (const domain of dataProduct.getDomains()) {
      await domain.delete(apiContext);
    }
    await afterAction();
  });

  test('moves a side widget into the Overview card and back out', async ({
    adminPage,
    overviewCardUserPage,
  }) => {
    test.slow();

    const card = adminPage.locator(OVERVIEW_CARD);
    const domain = adminPage.locator(byId('KnowledgePanel.Domain'));
    const cardDomain = card.locator(byId('KnowledgePanel.Domain'));
    const description = card.locator(byId('KnowledgePanel.Description'));

    await test.step('drop the Domain widget onto the card', async () => {
      await openCustomizePage(adminPage, 'DataProduct');

      await expect(domain).toBeVisible();
      await expect(cardDomain).toHaveCount(0);

      await scrollIntoViewAndSettle(card);
      const descriptionBox = await getBox(description);
      // Right half of the card, over the Description widget it lands below.
      await dragToPoint(
        adminPage,
        domain.getByTestId('drag-widget-button'),
        descriptionBox.x + descriptionBox.width * 0.75,
        descriptionBox.y + descriptionBox.height * 0.75
      );

      await expect(cardDomain).toBeVisible();
      await expect
        .poll(() => getCardColumns(cardDomain, card))
        .toEqual({ start: 3, span: 3 });
      await expect.poll(() => isBelow(cardDomain, description)).toBe(true);

      await savePageLayout(adminPage);
    });

    await test.step('keeps its place in the card after reload', async () => {
      await openCustomizePage(adminPage, 'DataProduct');

      await expect(cardDomain).toBeVisible();
      await expect
        .poll(() => getCardColumns(cardDomain, card))
        .toEqual({ start: 3, span: 3 });
      await expect.poll(() => isBelow(cardDomain, description)).toBe(true);
    });

    await test.step('shows it below Description on the entity page', async () => {
      const entityCard = overviewCardUserPage.locator(OVERVIEW_CARD);
      const entityDomain = entityCard.locator(byId('KnowledgePanel.Domain'));
      const entityDescription = entityCard.locator(
        byId('KnowledgePanel.Description')
      );
      const dataProductFqn =
        dataProduct.responseData.fullyQualifiedName ?? dataProduct.data.name;

      const dataProductResponse = waitForResponseWithStatus(
        overviewCardUserPage,
        (response) =>
          response.request().method() === 'GET' &&
          decodeURIComponent(new URL(response.url()).pathname).endsWith(
            `/dataProducts/name/${dataProductFqn}`
          ),
        200
      );
      await overviewCardUserPage.goto(
        `/dataProduct/${encodeURIComponent(dataProductFqn)}`,
        { waitUntil: 'domcontentloaded' }
      );
      await dataProductResponse;
      await waitForAllLoadersToDisappear(overviewCardUserPage);

      await expect(entityDescription).toBeVisible();
      await expect(entityDomain).toBeVisible();
      await expect
        .poll(() => isBelow(entityDomain, entityDescription))
        .toBe(true);
    });

    await test.step('drop it right of the card into the side column', async () => {
      await scrollIntoViewAndSettle(cardDomain);
      const [ownersBox, cardDomainBox] = await Promise.all([
        getBox(adminPage.locator(byId('KnowledgePanel.Owners'))),
        getBox(cardDomain),
      ]);
      // Over the side column, level with the widget being moved.
      await dragToPoint(
        adminPage,
        cardDomain.getByTestId('drag-widget-button'),
        ownersBox.x + ownersBox.width / 2,
        cardDomainBox.y + cardDomainBox.height / 2
      );

      await expect(domain).toBeVisible();
      await expect(cardDomain).toHaveCount(0);
      await expect.poll(() => isRightOf(domain, card)).toBe(true);

      await savePageLayout(adminPage);
    });

    await test.step('keeps it in the side column after reload', async () => {
      await openCustomizePage(adminPage, 'DataProduct');

      await expect(domain).toBeVisible();
      await expect(cardDomain).toHaveCount(0);
      await expect.poll(() => isRightOf(domain, card)).toBe(true);
    });
  });

  test('resizes a widget in the Overview card between half and full width', async ({
    adminPage,
  }) => {
    const card = adminPage.locator(OVERVIEW_CARD);
    const description = card.locator(byId('KnowledgePanel.Description'));
    const resizeHandle = description.locator(
      ':scope > .react-resizable-handle'
    );

    const resizeBy = async (offset: number) => {
      await scrollIntoViewAndSettle(description);
      const handleBox = await getBox(resizeHandle);
      await dragToPoint(
        adminPage,
        resizeHandle,
        handleBox.x + handleBox.width / 2 + offset,
        handleBox.y + handleBox.height / 2
      );
    };

    await test.step('shrink the Description widget to half the card', async () => {
      await openCustomizePage(adminPage, 'Domain');

      await expect
        .poll(() => getCardColumns(description, card))
        .toEqual({ start: 0, span: 6 });

      const cardBox = await getBox(card);
      await resizeBy(-cardBox.width / 2);

      await expect
        .poll(() => getCardColumns(description, card))
        .toEqual({ start: 0, span: 3 });

      await savePageLayout(adminPage);
    });

    await test.step('keeps the half width after reload', async () => {
      await openCustomizePage(adminPage, 'Domain');

      await expect
        .poll(() => getCardColumns(description, card))
        .toEqual({ start: 0, span: 3 });
    });

    await test.step('grow it back to the full card', async () => {
      const cardBox = await getBox(card);
      await resizeBy(cardBox.width / 2);

      await expect
        .poll(() => getCardColumns(description, card))
        .toEqual({ start: 0, span: 6 });

      await savePageLayout(adminPage);
    });
  });

  test('keeps the Overview card widgets inside the card, above the add-widget slot', async ({
    adminPage,
  }) => {
    await openCustomizePage(adminPage, 'GlossaryTerm');

    const card = adminPage.locator(OVERVIEW_CARD);
    const relatedTerms = card.locator(byId('KnowledgePanel.RelatedTerms'));
    const addWidgetSlot = adminPage.getByTestId(
      'ExtraWidget.EmptyWidgetPlaceholder'
    );

    await expect(relatedTerms).toBeVisible();
    await expect(addWidgetSlot).toBeVisible();

    // Related Terms is the card's last widget; before the card was sized to
    // its widgets it spilled past the card and under the add-widget slot.
    await expect
      .poll(async () => {
        const [cardBox, relatedTermsBox, slotBox] = await Promise.all([
          card.boundingBox(),
          relatedTerms.boundingBox(),
          addWidgetSlot.boundingBox(),
        ]);
        if (!cardBox || !relatedTermsBox || !slotBox) {
          return false;
        }
        const relatedTermsBottom = relatedTermsBox.y + relatedTermsBox.height;

        return (
          relatedTermsBottom <= cardBox.y + cardBox.height &&
          relatedTermsBottom <= slotBox.y
        );
      })
      .toBe(true);
  });
});
