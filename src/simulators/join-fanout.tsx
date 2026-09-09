import { useState } from 'react';
import { Chip, Chips, Muted } from '../ui/primitives';

/** Ported from legacy demoJoin. Same data, same two query shapes, same wording. */
interface Item { id: number; order_id: number; product_id: number }
interface Order { id: number; customer_id: number; total: number }

const items: Item[] = [
  { id: 1, order_id: 10, product_id: 42 },
  { id: 2, order_id: 10, product_id: 7 },
  { id: 3, order_id: 10, product_id: 42 },
];
const orders: Order[] = [
  { id: 10, customer_id: 1, total: 500 },
  { id: 11, customer_id: 1, total: 200 },
];
const items2: Item[] = [...items, { id: 4, order_id: 11, product_id: 7 }];

type Product = 'all' | 42 | 7;

export default function JoinFanoutSimulator() {
  const [mode, setMode] = useState<'join' | 'exists'>('join');
  const [product, setProduct] = useState<Product>(42);
  const p = product;
  const matches = (i: Item, o: Order) => i.order_id === o.id && (p === 'all' || i.product_id === p);

  const rows: { o: Order; i: Item | null }[] = [];
  if (mode === 'join') {
    orders.forEach((o) => items2.filter((i) => matches(i, o)).forEach((i) => rows.push({ o, i })));
  } else {
    orders.filter((o) => items2.some((i) => matches(i, o))).forEach((o) => rows.push({ o, i: null }));
  }
  const sum = rows.reduce((s, r) => s + r.o.total, 0);
  const real = orders.filter((o) => items2.some((i) => matches(i, o))).reduce((s, o) => s + o.total, 0);
  const cols = mode === 'join' ? 'grid-cols-5' : 'grid-cols-3';
  const ok = sum === real;

  return (
    <div className="flex flex-col gap-2 text-[14px]">
      <Muted>Data: Ziaur has order 10 (total 500, items: product 42, 7, 42) and order 11 (total 200, item: product 7).</Muted>
      <Muted>Query shape</Muted>
      <Chips>
        <Chip on={mode === 'join'} onClick={() => setMode('join')}>JOIN order_items</Chip>
        <Chip on={mode === 'exists'} onClick={() => setMode('exists')}>WHERE EXISTS (…)</Chip>
      </Chips>
      <Muted>Filter</Muted>
      <Chips>
        {(['all', 42, 7] as Product[]).map((v) => (
          <Chip key={String(v)} on={product === v} onClick={() => setProduct(v)}>
            {v === 'all' ? 'no product filter' : `product_id = ${v}`}
          </Chip>
        ))}
      </Chips>
      <Muted>Rows the database builds before SUM runs:</Muted>
      <div className="overflow-hidden rounded-xl border border-line text-[13px] dark:border-[#2a2e38]">
        <div className={`grid ${cols} bg-neutral-100 px-2 py-1.5 font-semibold dark:bg-[#1f232b]`}>
          <span>customer</span><span>o.id</span><span>o.total</span>
          {mode === 'join' && (<><span>i.id</span><span>i.product</span></>)}
        </div>
        {rows.length ? (
          rows.map((r, k) => (
            <div key={k} className={`grid ${cols} border-t border-line px-2 py-1.5 dark:border-[#2a2e38]`}>
              <span>Ziaur</span><span>{r.o.id}</span><span>{r.o.total}</span>
              {r.i && (<><span>{r.i.id}</span><span>{r.i.product_id}</span></>)}
            </div>
          ))
        ) : (
          <div className="p-2 text-neutral-500">no rows</div>
        )}
      </div>
      <div className="mt-1 flex justify-between">
        <div>
          <Muted>SUM(o.total) the query returns</Muted>
          <div className={`text-2xl font-semibold ${ok ? 'text-accent' : 'text-danger'}`}>{sum}</div>
        </div>
        <div className="text-right">
          <Muted>real revenue</Muted>
          <div className="text-2xl font-semibold">{real}</div>
        </div>
      </div>
      <div>
        {ok
          ? 'Correct. Each order appears exactly once.'
          : `Wrong by ${sum - real}. The order row was copied once per matching item — that is fan-out. GROUP BY would not change this number.`}
      </div>
    </div>
  );
}
