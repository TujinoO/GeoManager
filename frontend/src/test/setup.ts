import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import mapboxgl from "mapbox-gl";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

class MockResizeObserver {
  observe() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: MockResizeObserver,
});

Object.defineProperty(globalThis, "mapboxgl", {
  writable: true,
  configurable: true,
  value: mapboxgl,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

Object.defineProperty(window, "scrollTo", {
  writable: true,
  configurable: true,
  value: () => undefined,
});

Object.defineProperty(URL, "createObjectURL", {
  writable: true,
  configurable: true,
  value: () => "blob:test",
});

Object.defineProperty(URL, "revokeObjectURL", {
  writable: true,
  configurable: true,
  value: () => undefined,
});
