/**
 * Characterization: routes.jsx — current state after P05
 */

import routes from '@/router/routes';

describe('routes.jsx — characterization (post-P05)', () => {
  const defaultPaths = routes.default.map((r) => r.path);

  describe('R-a: /dashboard route now exists', () => {
    it('has a route for /dashboard', () => {
      expect(defaultPaths).toContain('/dashboard');
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
