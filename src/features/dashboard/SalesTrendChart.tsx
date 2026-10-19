import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { Money } from '@/components/shared/values'
import { Button } from '@/components/ui/button'
import { money, shortDate } from '@/lib/format'
import type { components } from '@/lib/api/schema'

type Point = components['schemas']['TrendPoint']

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const label = (bucket: string | undefined, by: 'day' | 'month') =>
  !bucket
    ? ''
    : by === 'day'
      ? shortDate(bucket)
      : `${MONTHS[Number(bucket.slice(5, 7)) - 1]} ${bucket.slice(2, 4)}`

/** Clean axis ticks (0, 10K, 20K…): steps of 1, 2, 2.5 or 5 × 10ⁿ, about four of them. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0]
  const raw = max / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * pow >= raw) ?? 10) * pow
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step)
}

// Axis ticks only: compact Indian notation (12K, 1.5L, 2Cr).
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 })

/**
 * Sales per day or month: one series, so no legend (the title names it). Profit and bill
 * count ride in the tooltip rather than a second scale (dataviz: one axis).
 */
export function SalesTrendChart({ points, bucket }: { points: Point[]; bucket: 'day' | 'month' }) {
  const [asTable, setAsTable] = useState(false)
  // Recharts needs numbers to draw; these values are plotted, never added up (D-07).
  const data = points.map((p) => ({
    ...p,
    label: label(p.bucket, bucket),
    value: Number(p.sales ?? 0),
  }))
  const ticks = niceTicks(Math.max(0, ...data.map((d) => d.value)))
  return (
    <section aria-label="Sales trend" className="grid gap-2 rounded-lg border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Sales by {bucket === 'day' ? 'day' : 'month'} ₹</h2>
        <Button variant="ghost" size="sm" onClick={() => setAsTable((t) => !t)}>
          {asTable ? 'Show as chart' : 'Show as table'}
        </Button>
      </div>
      {data.length === 0 ? (
        <p className="py-10 text-center text-ink-muted">No sales in this period.</p>
      ) : asTable ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs tracking-wide text-ink-muted uppercase">
              <th className="py-1 font-medium">{bucket === 'day' ? 'Day' : 'Month'}</th>
              <th className="py-1 text-right font-medium">Bills</th>
              <th className="py-1 text-right font-medium">Sales ₹</th>
              <th className="py-1 text-right font-medium">Profit ₹</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.bucket} className="border-t">
                <td className="py-1">{p.label}</td>
                <td className="py-1 text-right tabular">{p.bills}</td>
                <td className="py-1 text-right">
                  <Money value={p.sales} />
                </td>
                <td className="py-1 text-right">
                  <Money value={p.profit} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div
          className="h-56"
          role="img"
          aria-label={`Sales by ${bucket}; use "Show as table" for the values`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--color-rule)" strokeWidth={1} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={{ stroke: 'var(--color-rule)' }}
                tick={{ fill: 'var(--color-ink-muted)', fontSize: 12 }}
                interval="preserveStartEnd"
                minTickGap={12}
              />
              <YAxis
                width={48}
                ticks={ticks}
                domain={[0, ticks.at(-1) ?? 'auto']}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--color-ink-muted)', fontSize: 12 }}
                tickFormatter={(v: number) => compact.format(v)}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-steel-tint)' }}
                content={(props) => <TrendTooltip {...props} />}
              />
              <Bar
                dataKey="value"
                fill="var(--color-chart-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

function TrendTooltip({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  const p = payload?.[0]?.payload as (Point & { label: string }) | undefined
  if (!active || !p) return null
  return (
    <div className="rounded-md border bg-surface px-3 py-2 text-sm shadow-pop">
      <p className="font-medium">{p.label}</p>
      <p className="tabular">Sales ₹ {money(p.sales)}</p>
      <p className="text-ink-muted tabular">
        Profit ₹ {money(p.profit)} · {p.bills ?? 0} bills
      </p>
    </div>
  )
}
