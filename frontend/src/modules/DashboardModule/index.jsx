import { useEffect, useState } from 'react';

import { Tag, Row, Col, DatePicker } from 'antd';
import dayjs from 'dayjs';
import useLanguage from '@/locale/useLanguage';

import { useMoney } from '@/settings';

import { request } from '@/request';
import useFetch from '@/hooks/useFetch';
import useOnFetch from '@/hooks/useOnFetch';

import RecentTable from './components/RecentTable';

import SummaryCard from './components/SummaryCard';
import PreviewCard from './components/PreviewCard';
import CustomerPreviewCard from './components/CustomerPreviewCard';
import TrendChart from './components/TrendChart';

import { selectMoneyFormat } from '@/redux/settings/selectors';
import { useSelector } from 'react-redux';

const { RangePicker } = DatePicker;

export default function DashboardModule() {
  const translate = useLanguage();
  const { moneyFormatter } = useMoney();
  const money_format_settings = useSelector(selectMoneyFormat);

  // ── Date range state (default: last 30 days) ───────────────────────────────
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(29, 'day'),
    dayjs(),
  ]);

  // ── Summary stats (existing) ───────────────────────────────────────────────
  const getStatsData = async ({ entity, currency }) => {
    return await request.summary({
      entity,
      options: { currency },
    });
  };

  const {
    result: invoiceResult,
    isLoading: invoiceLoading,
    onFetch: fetchInvoicesStats,
  } = useOnFetch();

  const { result: quoteResult, isLoading: quoteLoading, onFetch: fetchQuotesStats } = useOnFetch();

  const {
    result: paymentResult,
    isLoading: paymentLoading,
    onFetch: fetchPayemntsStats,
  } = useOnFetch();

  const { result: clientResult, isLoading: clientLoading } = useFetch(() =>
    request.summary({ entity: 'client' })
  );

  // ── Trend data ─────────────────────────────────────────────────────────────
  const {
    result: trendResult,
    isLoading: trendLoading,
    onFetch: fetchTrend,
  } = useOnFetch();

  useEffect(() => {
    const currency = money_format_settings.default_currency_code || null;

    if (currency) {
      fetchInvoicesStats(getStatsData({ entity: 'invoice', currency }));
      fetchQuotesStats(getStatsData({ entity: 'quote', currency }));
      fetchPayemntsStats(getStatsData({ entity: 'payment', currency }));
    }
  }, [money_format_settings.default_currency_code]);

  useEffect(() => {
    const currency = money_format_settings.default_currency_code || '';
    const startDate = dateRange[0].format('YYYY-MM-DD');
    const endDate = dateRange[1].format('YYYY-MM-DD');
    fetchTrend(
      request.get({
        entity: `dashboard/trend?startDate=${startDate}&endDate=${endDate}${currency ? `&currency=${currency}` : ''}`,
      })
    );
  }, [dateRange, money_format_settings.default_currency_code]);

  // ── Columns for recent tables ──────────────────────────────────────────────
  const dataTableColumns = [
    {
      title: translate('number'),
      dataIndex: 'number',
    },
    {
      title: translate('Client'),
      dataIndex: ['client', 'name'],
    },
    {
      title: translate('Total'),
      dataIndex: 'total',
      onCell: () => ({
        style: { textAlign: 'right', whiteSpace: 'nowrap', direction: 'ltr' },
      }),
      render: (total, record) => moneyFormatter({ amount: total, currency_code: record.currency }),
    },
    {
      title: translate('Status'),
      dataIndex: 'status',
    },
  ];

  const entityData = [
    {
      result: invoiceResult,
      isLoading: invoiceLoading,
      entity: 'invoice',
      title: translate('Invoices'),
    },
    {
      result: quoteResult,
      isLoading: quoteLoading,
      entity: 'quote',
      title: translate('quote'),
    },
  ];

  const statisticCards = entityData.map((data, index) => {
    const { result, entity, isLoading, title } = data;

    return (
      <PreviewCard
        key={index}
        title={title}
        isLoading={isLoading}
        entity={entity}
        statistics={
          !isLoading &&
          result?.performance?.map((item) => ({
            tag: item?.status,
            color: 'blue',
            value: item?.percentage,
          }))
        }
      />
    );
  });

  if (money_format_settings) {
    return (
      <>
        <Row gutter={[32, 32]}>
          <SummaryCard
            title={translate('Invoices')}
            prefix={translate('This month')}
            isLoading={invoiceLoading}
            data={invoiceResult?.total}
          />
          <SummaryCard
            title={translate('Quote')}
            prefix={translate('This month')}
            isLoading={quoteLoading}
            data={quoteResult?.total}
          />
          <SummaryCard
            title={translate('paid')}
            prefix={translate('This month')}
            isLoading={paymentLoading}
            data={paymentResult?.total}
          />
          <SummaryCard
            title={translate('Unpaid')}
            prefix={translate('Not Paid')}
            isLoading={invoiceLoading}
            data={invoiceResult?.total_undue}
          />
        </Row>
        <div className="space30"></div>

        {/* ── Trend chart ────────────────────────────────────────────────── */}
        <Row gutter={[32, 32]}>
          <Col span={24}>
            <div className="whiteBox shadow pad20">
              <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
                <Col>
                  <h3 style={{ color: '#22075e', margin: 0 }}>
                    {translate('Invoice & Payment Trend')}
                  </h3>
                </Col>
                <Col>
                  <RangePicker
                    value={dateRange}
                    onChange={(range) => range && setDateRange(range)}
                    allowClear={false}
                  />
                </Col>
              </Row>
              <TrendChart days={trendResult?.days ?? []} isLoading={trendLoading} />
            </div>
          </Col>
        </Row>
        <div className="space30"></div>

        <Row gutter={[32, 32]}>
          <Col className="gutter-row w-full" sm={{ span: 24 }} md={{ span: 24 }} lg={{ span: 18 }}>
            <div className="whiteBox shadow" style={{ height: 458 }}>
              <Row className="pad20" gutter={[0, 0]}>
                {statisticCards}
              </Row>
            </div>
          </Col>
          <Col className="gutter-row w-full" sm={{ span: 24 }} md={{ span: 24 }} lg={{ span: 6 }}>
            <CustomerPreviewCard
              isLoading={clientLoading}
              activeCustomer={clientResult?.active}
              newCustomer={clientResult?.new}
            />
          </Col>
        </Row>
        <div className="space30"></div>
        <Row gutter={[32, 32]}>
          <Col className="gutter-row w-full" sm={{ span: 24 }} lg={{ span: 12 }}>
            <div className="whiteBox shadow pad20" style={{ height: '100%' }}>
              <h3 style={{ color: '#22075e', marginBottom: 5, padding: '0 20px 20px' }}>
                {translate('Recent Invoices')}
              </h3>
              <RecentTable entity={'invoice'} dataTableColumns={dataTableColumns} />
            </div>
          </Col>
          <Col className="gutter-row w-full" sm={{ span: 24 }} lg={{ span: 12 }}>
            <div className="whiteBox shadow pad20" style={{ height: '100%' }}>
              <h3 style={{ color: '#22075e', marginBottom: 5, padding: '0 20px 20px' }}>
                {translate('Recent Quotes')}
              </h3>
              <RecentTable entity={'quote'} dataTableColumns={dataTableColumns} />
            </div>
          </Col>
        </Row>
      </>
    );
  } else {
    return <></>;
  }
}
