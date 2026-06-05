import { Spin } from 'antd';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useSelector } from 'react-redux';
import { useMoney } from '@/settings';
import { selectMoneyFormat } from '@/redux/settings/selectors';

export default function TrendChart({ days = [], isLoading = false }) {
  const { moneyFormatter } = useMoney();
  const moneyFormat = useSelector(selectMoneyFormat);
  const currency = moneyFormat?.default_currency_code;

  const fmt = (amount) => moneyFormatter({ amount, currency_code: currency });

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin />
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={days} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="left" orientation="left" tickFormatter={fmt} width={90} />
        <YAxis yAxisId="right" orientation="right" tickFormatter={fmt} width={90} />
        <Tooltip
          formatter={(value, name) => [fmt(value), name]}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="invoiceTotal"
          stroke="#1890ff"
          name="Invoice Total"
          dot={false}
          strokeWidth={2}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="paymentAmount"
          stroke="#52c41a"
          name="Payment Amount"
          dot={false}
          strokeWidth={2}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
