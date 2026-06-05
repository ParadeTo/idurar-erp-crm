/**
 * Characterization: NavigationContainer — current state before P06
 *
 * Locks down:
 *   N-a  dashboard menu item link is currently to='/'  (will change to '/dashboard' in P06)
 *   N-b  invoice menu item link is to='/invoice'
 *   N-c  payment menu item link is to='/payment'
 *   N-d  customer menu item link is to='/customer'
 *
 * Implementation note:
 * NavigationContainer has many runtime dependencies (AppContext, i18n, router,
 * antd icons, responsive hook). Rather than render the full component, we
 * characterize the items array by importing the module and inspecting the
 * statically-defined link targets via a lightweight regex over the source.
 *
 * If the items array is refactored into a separate constant this test should
 * be updated to import that constant directly.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dir = dirname(__filename);

const src = readFileSync(
  resolve(__dir, 'NavigationContainer.jsx'),
  'utf-8'
);

describe('NavigationContainer.jsx — characterization (pre-P06)', () => {
  describe('N-a: dashboard menu item links to "/"', () => {
    it('contains <Link to={"/"}>  for the dashboard entry', () => {
      // Match the dashboard key block containing its Link target
      // Characterize: currently <Link to={'/'}> (will become '/dashboard' in P06)
      expect(src).toMatch(/key:\s*['"]dashboard['"]/);
      const dashboardBlock = src.slice(
        src.indexOf("key: 'dashboard'"),
        src.indexOf("key: 'customer'")
      );
      expect(dashboardBlock).toContain("to={'/'}");
      expect(dashboardBlock).not.toContain("to={'/dashboard'}");
    });
  });

  describe('N-b–d: other key menu items have correct link targets', () => {
    it("invoice link is to='/invoice'", () => {
      expect(src).toContain("to={'/invoice'}");
    });

    it("payment link is to='/payment'", () => {
      expect(src).toContain("to={'/payment'}");
    });

    it("customer link is to='/customer'", () => {
      expect(src).toContain("to={'/customer'}");
    });
  });
});
