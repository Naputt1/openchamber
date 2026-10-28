import { afterEach, describe, expect, test } from 'bun:test';
import React, { act } from 'react';
import type { Root } from 'react-dom/client';
import { Window } from 'happy-dom';

const browser = new Window({ url: 'http://localhost/' });
Object.assign(globalThis, {
  window: browser, document: browser.document, navigator: browser.navigator, localStorage: browser.localStorage,
  Node: browser.Node, Element: browser.Element, HTMLElement: browser.HTMLElement,
  HTMLImageElement: browser.HTMLImageElement, ResizeObserver: browser.ResizeObserver,
  Event: browser.Event, IS_REACT_ACT_ENVIRONMENT: true,
});
// React DOM and the i18n store read the DOM when imported, so it goes in first.
const { createRoot } = await import('react-dom/client');
const { I18nProvider } = await import('@/lib/i18n');
const { ImageArtifact } = await import('./ImageArtifact');

const LOADING = 'Loading...';
const UNREADABLE = 'This image cannot be shown here';

let reactRoot: Root | null = null;
let container: HTMLElement | null = null;

// Owns `src` the way FilesView does: it exists only once the bytes were read.
const show = async (src: string) => {
  await act(async () => reactRoot?.render(
    <I18nProvider><ImageArtifact src={src} name="shot.png" sizeBytes={2048} /></I18nProvider>,
  ));
};

const render = async (src: string) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  reactRoot = createRoot(container);
  await show(src);
};

const image = () => container?.querySelector('img') ?? null;

afterEach(async () => {
  await act(async () => reactRoot?.unmount());
  container?.remove();
  reactRoot = null;
  container = null;
});

describe('ImageArtifact', () => {
  test('waits with a loading line and renders no image until the source arrives', async () => {
    await render('');
    expect(container?.textContent).toContain(LOADING);
    expect(image()).toBeNull();

    await show('blob:http://localhost/a');
    expect(image()?.getAttribute('src')).toBe('blob:http://localhost/a');
    // The element exists, the picture does not: the browser has not decoded it yet.
    expect(container?.textContent).toContain(LOADING);
  });

  test('drops the loading line once the browser reports the image', async () => {
    await render('blob:http://localhost/a');
    const element = image();
    if (!element) throw new Error('no image element');
    Object.defineProperty(element, 'naturalWidth', { configurable: true, get: () => 640 });
    Object.defineProperty(element, 'naturalHeight', { configurable: true, get: () => 480 });
    await act(async () => { element.dispatchEvent(new Event('load')); });
    expect(container?.textContent).not.toContain(LOADING);
    expect(container?.textContent).toContain('640 × 480');
    expect(image()).toBe(element);
  });

  test('says the image cannot be shown when the browser cannot decode it', async () => {
    await render('blob:http://localhost/broken');
    await act(async () => { image()?.dispatchEvent(new Event('error')); });
    expect(container?.textContent).toContain(UNREADABLE);
    expect(image()).toBeNull();
  });
});
