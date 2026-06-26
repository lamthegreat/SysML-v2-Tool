/**
 * Build-time stub for the Community Edition. When VITE_PLATFORM !== "true",
 * `vite.config.ts` aliases `@sygil/platform` to this file so the proprietary
 * hosted-platform code is fully excluded from the CE bundle.
 *
 * The tsconfig `paths` also points here so tsc resolves `@sygil/platform`
 * without the private repo being present. The exported member satisfies the
 * dynamic `import("@sygil/platform")` in App.tsx, which is never invoked in
 * the CE build (guarded by the PLATFORM flag).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function PlatformRepoBar(_props: Record<string, any>): null {
  return null;
}
