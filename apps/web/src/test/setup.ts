import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest runs without `globals: true` (tests import from "vitest" explicitly), so React
// Testing Library's automatic cleanup never registers itself — renders from earlier tests
// stay mounted and queries start matching duplicates. Register it here instead.
afterEach(cleanup);
