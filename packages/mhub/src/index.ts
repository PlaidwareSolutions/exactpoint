/**
 * @exactpoint/mhub — vendored copy of @plaidware/mhub-sdk (see src/vendor/).
 * Vendored rather than a file: dependency so Railway builds (which only see
 * this repo) can resolve it. To update, re-copy from
 * marketing-hub-claude/packages/sdk/src; the only local change is dropping
 * the `.js` suffix from relative imports (Turbopack resolves TS sources
 * extensionless).
 */
export * from "./vendor/index";
