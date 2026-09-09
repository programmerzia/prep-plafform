import { useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useStore } from '../../store/Store';
import type { CanvasArrow, CanvasBox, CanvasDoc } from '../../store/types';
import { Button, Card, Chip, Chips, Muted, Page } from '../../ui/primitives';

const W = 1000;
const H = 700;
const BOX_W = 150;
const BOX_H = 60;

function newDoc(): CanvasDoc {
  return { id: `c-${Date.now()}`, name: 'Untitled design', boxes: [], arrows: [], updated: Date.now() };
}

function download(name: string, url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
}

/** More → Design canvas screen. */
export function Canvas() {
  return <CanvasEditor />;
}

/**
 * Draggable labelled boxes + arrows. Touch first: drag to move, tap to select, Connect mode to link two boxes.
 * `embedded` renders without the page chrome so a module can use it as the `design-canvas` simulator.
 */
export function CanvasEditor({ embedded = false }: { embedded?: boolean }) {
  const { canvases, saveCanvas, removeCanvas } = useStore();
  const [doc, setDoc] = useState<CanvasDoc>(() => canvases[0] ?? newDoc());
  const [selected, setSelected] = useState<string | null>(null);
  const [connect, setConnect] = useState<string | null>(null); // first box picked in connect mode
  const [connectMode, setConnectMode] = useState(false);
  const [msg, setMsg] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const update = (patch: Partial<CanvasDoc>) => setDoc((d) => ({ ...d, ...patch, updated: Date.now() }));

  const svgPoint = (e: RPointerEvent) => {
    const svg = svgRef.current!;
    const r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const addBox = () => {
    const label = prompt('Box label', 'Service') ?? '';
    if (!label.trim()) return;
    const n = doc.boxes.length;
    const box: CanvasBox = { id: `b-${Date.now()}`, x: 60 + (n % 4) * 200, y: 60 + Math.floor(n / 4) * 120, w: BOX_W, h: BOX_H, label: label.trim() };
    update({ boxes: [...doc.boxes, box] });
    setSelected(box.id);
  };

  const onBoxDown = (e: RPointerEvent, b: CanvasBox) => {
    e.stopPropagation();
    if (connectMode) {
      if (!connect) {
        setConnect(b.id);
        setMsg(`From "${b.label}" — now tap the target box.`);
      } else if (connect !== b.id) {
        const arrow: CanvasArrow = { id: `a-${Date.now()}`, from: connect, to: b.id };
        update({ arrows: [...doc.arrows, arrow] });
        setConnect(null);
        setMsg('Arrow added.');
      }
      return;
    }
    setSelected(b.id);
    const p = svgPoint(e);
    drag.current = { id: b.id, dx: p.x - b.x, dy: p.y - b.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: RPointerEvent) => {
    if (!drag.current) return;
    const p = svgPoint(e);
    const { id, dx, dy } = drag.current;
    setDoc((d) => ({
      ...d,
      boxes: d.boxes.map((b) => (b.id === id ? { ...b, x: Math.max(0, Math.min(W - b.w, p.x - dx)), y: Math.max(0, Math.min(H - b.h, p.y - dy)) } : b)),
    }));
  };
  const onUp = () => {
    if (drag.current) update({});
    drag.current = null;
  };

  const rename = () => {
    if (!selected) return;
    const box = doc.boxes.find((b) => b.id === selected);
    const arrow = doc.arrows.find((a) => a.id === selected);
    if (box) {
      const label = prompt('Box label', box.label);
      if (label !== null) update({ boxes: doc.boxes.map((b) => (b.id === box.id ? { ...b, label } : b)) });
    } else if (arrow) {
      const label = prompt('Arrow label (e.g. HTTP, queue, SQL)', arrow.label ?? '');
      if (label !== null) update({ arrows: doc.arrows.map((a) => (a.id === arrow.id ? { ...a, label } : a)) });
    }
  };

  const del = () => {
    if (!selected) return;
    update({
      boxes: doc.boxes.filter((b) => b.id !== selected),
      arrows: doc.arrows.filter((a) => a.id !== selected && a.from !== selected && a.to !== selected),
    });
    setSelected(null);
  };

  const save = async () => {
    const name = prompt('Save as', doc.name);
    if (name === null) return;
    const d = { ...doc, name: name.trim() || doc.name, updated: Date.now() };
    setDoc(d);
    await saveCanvas(d);
    setMsg('Saved on this device.');
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    download(`${doc.name.replace(/\s+/g, '-')}.json`, URL.createObjectURL(blob));
  };

  const importJson = async (file: File) => {
    try {
      const d = JSON.parse(await file.text()) as CanvasDoc;
      if (!Array.isArray(d.boxes) || !Array.isArray(d.arrows)) throw new Error('not a canvas file');
      setDoc({ ...d, id: d.id || `c-${Date.now()}`, updated: Date.now() });
      setMsg('Loaded from file.');
    } catch (e) {
      setMsg(`Could not load: ${(e as Error).message}`);
    }
  };

  const exportPng = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(W));
    clone.setAttribute('height', String(H));
    const xml = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = W * 2;
      c.height = H * 2;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      download(`${doc.name.replace(/\s+/g, '-')}.png`, c.toDataURL('image/png'));
    };
    img.onerror = () => setMsg('PNG export failed in this browser. Use JSON.');
    img.src = url;
  };

  const center = (b: CanvasBox) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  const edgePoint = (from: CanvasBox, to: CanvasBox) => {
    // where the line from center(from) toward center(to) leaves the "from" rectangle
    const c = center(from), t = center(to);
    const dx = t.x - c.x, dy = t.y - c.y;
    if (dx === 0 && dy === 0) return c;
    const sx = from.w / 2 / Math.abs(dx || 1e-9), sy = from.h / 2 / Math.abs(dy || 1e-9);
    const s = Math.min(sx, sy);
    return { x: c.x + dx * s, y: c.y + dy * s };
  };

  const body = (
    <>
      {embedded && (
        <div className="flex items-center justify-between">
          <Muted>{doc.name}</Muted>
          <Button variant="ghost" onClick={save}>Save</Button>
        </div>
      )}
      <Chips>
        <Button variant="primary" onClick={addBox}>+ Box</Button>
        <Chip on={connectMode} onClick={() => { setConnectMode(!connectMode); setConnect(null); setMsg(connectMode ? '' : 'Connect: tap the source box, then the target box.'); }}>
          Connect
        </Chip>
        <Button disabled={!selected} onClick={rename}>Label</Button>
        <Button variant="danger" disabled={!selected} onClick={del}>Delete</Button>
      </Chips>
      {msg && <Muted>{msg}</Muted>}

      <div className="overflow-hidden rounded-2xl border border-line bg-white dark:border-[#2a2e38]" style={{ touchAction: 'none' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onPointerDown={() => { setSelected(null); if (connectMode) setConnect(null); }}
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
              <path d="M0,0 L10,4 L0,8 z" fill="#1c1e24" />
            </marker>
          </defs>
          <rect width={W} height={H} fill="#ffffff" />
          {doc.arrows.map((a) => {
            const from = doc.boxes.find((b) => b.id === a.from);
            const to = doc.boxes.find((b) => b.id === a.to);
            if (!from || !to) return null;
            const p1 = edgePoint(from, to), p2 = edgePoint(to, from);
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const sel = selected === a.id;
            return (
              <g key={a.id} onPointerDown={(e) => { e.stopPropagation(); setSelected(a.id); }}>
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={28} />
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={sel ? '#1f8f4e' : '#1c1e24'} strokeWidth={sel ? 4 : 2.5} markerEnd="url(#arrowhead)" />
                {a.label && (
                  <text x={mid.x} y={mid.y - 8} fontSize={18} textAnchor="middle" fill="#1c1e24" fontFamily="system-ui, sans-serif">
                    {a.label}
                  </text>
                )}
              </g>
            );
          })}
          {doc.boxes.map((b) => {
            const sel = selected === b.id || connect === b.id;
            return (
              <g key={b.id} onPointerDown={(e) => onBoxDown(e, b)} style={{ cursor: 'grab' }}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={12} fill={sel ? '#e6f4ea' : '#f7f7f5'} stroke={sel ? '#1f8f4e' : '#1c1e24'} strokeWidth={sel ? 4 : 2.5} />
                <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 7} fontSize={20} textAnchor="middle" fill="#1c1e24" fontFamily="system-ui, sans-serif">
                  {b.label.length > 16 ? `${b.label.slice(0, 15)}…` : b.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <Chips>
        <Button onClick={exportPng}>Export PNG</Button>
        <Button onClick={exportJson}>Export JSON</Button>
        <Button onClick={() => fileRef.current?.click()}>Load JSON</Button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        <Button onClick={() => { setDoc(newDoc()); setSelected(null); }}>New</Button>
      </Chips>

      <Card>
        <Muted className="mb-2">Saved on this device</Muted>
        {canvases.length === 0 && <Muted>Nothing saved yet.</Muted>}
        <Chips>
          {canvases.map((c) => (
            <Chip key={c.id} on={c.id === doc.id} onClick={() => { setDoc(c); setSelected(null); }}>
              {c.name}
            </Chip>
          ))}
        </Chips>
        {canvases.some((c) => c.id === doc.id) && (
          <Button variant="danger" className="mt-3" onClick={async () => { if (confirm(`Delete "${doc.name}"?`)) { await removeCanvas(doc.id); setDoc(newDoc()); } }}>
            Delete this design
          </Button>
        )}
      </Card>
    </>
  );

  if (embedded) return <div className="flex flex-col gap-3">{body}</div>;
  return (
    <Page back="/more" title={doc.name} actions={<Button variant="ghost" onClick={save}>Save</Button>}>
      {body}
    </Page>
  );
}
