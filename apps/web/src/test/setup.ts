import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom implements no layout at all, so scroll APIs are simply absent — calling one throws
// "not a function" rather than doing nothing. Stub it here instead of guarding at every
// call site: a component asking the browser to scroll is correct behaviour, and the test
// environment lacking a viewport is the environment's problem to paper over.
Element.prototype.scrollIntoView = vi.fn();

// Vitest runs without `globals: true` (tests import from "vitest" explicitly), so React
// Testing Library's automatic cleanup never registers itself — renders from earlier tests
// stay mounted and queries start matching duplicates. Register it here instead.
afterEach(cleanup);
