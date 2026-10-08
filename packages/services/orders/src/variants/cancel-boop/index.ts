import type { ServiceDeps } from "@sudsnik/contracts";
import { composeApp } from "../../core/composeApp.js";
import { CancelBoopOrdersService } from "./CancelBoopOrdersService.js";

export const variant = "cancel-boop";

export function createApp(deps: ServiceDeps) {
  return composeApp(deps, { variant, service: (parts) => new CancelBoopOrdersService(parts.repo, parts.outbox, parts.deps) });
}
