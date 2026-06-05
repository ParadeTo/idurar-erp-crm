/**
 * TrendChart — TDD tests (written before implementation)
 *
 * Covers:
 *   T-a  isLoading=true → renders Spin, no chart
 *   T-b  days provided → chart container renders without crash
 *   T-c  days=[] (empty) → chart renders without crash
 *   T-d  days data is passed through to chart data
 */

import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

// Mock recharts — we test component logic, not the charting library
vi.mock('recharts', () => ({
  ComposedChart: ({ children, data }) => (
    <div data-testid="composed-chart" data-days={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }) => <div data-testid="chart-container">{children}</div>,
}));

vi.mock('@/settings', () => ({
  useMoney: () => ({ moneyFormatter: ({ amount }) => `$${amount}` }),
}));

vi.mock('react-redux', () => ({
  useSelector: () => ({ default_currency_code: 'USD' }),
}));

import TrendChart from './TrendChart';

const sampleDays = [
  { date: '2026-05-01', invoiceTotal: 1000, paymentAmount: 500 },
  { date: '2026-05-02', invoiceTotal: 0, paymentAmount: 200 },
];

describe('TrendChart', () => {
  describe('T-a: isLoading=true → Spin, no chart', () => {
    it('renders Spin and hides chart when loading', () => {
      render(<TrendChart days={sampleDays} isLoading={true} />);
      expect(screen.queryByTestId('chart-container')).not.toBeInTheDocument();
      // antd Spin renders a .ant-spin element
      const spinner = document.querySelector('.ant-spin');
      expect(spinner).toBeTruthy();
    });
  });

  describe('T-b: days provided → chart renders', () => {
    it('renders chart container when not loading', () => {
      render(<TrendChart days={sampleDays} isLoading={false} />);
      expect(screen.getByTestId('chart-container')).toBeInTheDocument();
      expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
    });

    it('passes days array to the chart', () => {
      render(<TrendChart days={sampleDays} isLoading={false} />);
      const chart = screen.getByTestId('composed-chart');
      const data = JSON.parse(chart.getAttribute('data-days'));
      expect(data).toHaveLength(2);
      expect(data[0].invoiceTotal).toBe(1000);
    });
  });

  describe('T-c: empty days → no crash', () => {
    it('renders chart container with empty data without crashing', () => {
      render(<TrendChart days={[]} isLoading={false} />);
      expect(screen.getByTestId('chart-container')).toBeInTheDocument();
    });
  });

  describe('T-d: default props → no crash', () => {
    it('renders without any props', () => {
      render(<TrendChart />);
      expect(screen.getByTestId('chart-container')).toBeInTheDocument();
    });
  });
});
