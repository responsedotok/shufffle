import type { RouteRewrite } from '../lib/types/route-rewrite.js';

/**
 * Apply rewrite rules to the forwarded pathname.
 * @param pathname The request path to rewrite.
 * @param rewrite The rewrite rules to apply.
 * @returns The rewritten path.
 */
export function rewritePath(pathname: string, rewrite?: RouteRewrite): string {
  if (!rewrite) return pathname;

  if (rewrite.replacePath !== undefined) return rewrite.replacePath;

  let result = pathname;

  if (rewrite.stripPrefix) {
    const prefix = rewrite.stripPrefix;
    if (result === prefix) {
      result = '/';
    } else if (result.startsWith(prefix) && result[prefix.length] === '/') {
      result = result.slice(prefix.length);
    }
  }

  if (rewrite.addPrefix) {
    result = rewrite.addPrefix + result;
  }

  return result;
}
