/**
 * Characterization: routes.jsx — current state before P05
 *
 * Locks down:
 *   R-a  /dashboard does NOT exist in the route table
 *   R-b  / (root) IS defined
 *   R-c  /invoice IS defined
 *   R-d  /payment IS defined
 *   R-e  /customer IS defined
 *   R-f  enterprise routes (quote, paymentMode, taxes) are absent after cleanup
 *
 * These tests MUST pass before P05 is implemented.
 * After P05, R-a will fail — that's the signal the change landed.
 */

import routes from '@/router/routes';

describe('routes.jsx — characterization (pre-P05)', () => {
  const defaultPaths = routes.default.map((r) => r.path);

  describe('R-a: /dashboard does not exist yet', () => {
    it('has no route for /dashboard', () => {
      expect(defaultPaths).not.toContain('/dashboard');
    });
  });

  describe('R-b–e: core OSS routes are registered', () => {
    const requiredPaths = ['/', '/invoice', '/payment', '/customer'];

    requiredPaths.forEach((p) => {
      it(`${p} is defined`, () => {
        expect(defaultPaths).toContain(p);
      });
    });
  });

  describe('R-f: removed enterprise routes are absent', () => {
    const enterprisePaths = ['/quote', '/payment/mode', '/taxes'];

    enterprisePaths.forEach((p) => {
      it(`${p} is absent (enterprise-only, removed in fix)`, () => {
        expect(defaultPaths).not.toContain(p);
      });
    });
  });
});
