/**
 * Build-time stub for the Community Edition. When VITE_PLATFORM !== "true",
 * `vite.config.ts` aliases `@sygil/platform` to this file so the proprietary
 * hosted-platform code is fully excluded from the CE bundle.
 *
 * The exported member exists only to satisfy the dynamic `import("@sygil/platform")`
 * in App.tsx, which is never invoked in the CE build (the call is guarded by the
 * PLATFORM flag). Types still come from the real package via tsconfig `paths`.
 */
export const PlatformRepoBar = () => null;
