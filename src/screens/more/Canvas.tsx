import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useStore } from '../../store/Store';
import type { CanvasArrow, CanvasBox, CanvasDoc } from '../../store/types';
import { Button, Card, Chip, Chips, Muted, Page, Reveal } from '../../ui/primitives';
import { Timer } from '../../ui/Timer';
import {
  ARROW_LABELS, commit, makeHistory, newArrow, newBox, PALETTE, redo, snap, TALK_PROMPTS, TALK_SECONDS,
  TEMPLATES, templateReference, templateStarter, undo, type History,
} from '../../simulators/logic/design-canvas';

const W = 1000;
const H = 700;

function newDoc(): CanvasDoc {
  return { id: `c-${Date.now()}`, name: 'Untitled design', boxes: [], arrows: [], notes: '', updated: Date.now() };
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
  const [hist, setHist] = useState<History>(() => makeHistory(canvases[0] ?? newDoc()));
  const doc = hist.present;
  const [selected, setSelected] = useState<string | null>(null);
  const [connect, setConnect] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [snapOn, setSnapOn] = useState(true);
  const [msg, setMsg] = useState('');
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [talk, setTalk] = useState<{ step: number; running: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean; before: CanvasDoc } | null>(null);

  /** Replace the document without a history entry (used while dragging). */
  const setDocLive = (next: CanvasDoc) => setHist((h) => ({ ...h, present: next }));
  /** Replace the document and record an undo step. */
  const setDoc = (next: CanvasDoc) => setHist((h) => commit(h, { ...next, updated: Date.now() }));
  const patch = (p: Partial<CanvasDoc>) => setDoc({ ...doc, ...p });
  const load = (d: CanvasDoc) => {
    setHist(makeHistory(d));
    setSelected(null);
    setConnect(null);
  };

  const template = useMemo(() => TEMPLATES.find((t) => t.id === templateId) ?? null, [templateId]);
  const reference = useMemo(() => (template ? templateReference(template) : null), [template]);

  const svgPoint = (e: RPointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const addBox = (label: string) => {
    const box = newBox(label, doc.boxes.length, snapOn);
    patch({ boxes: [...doc.boxes, box] });
    setSelected(box.id);
  };

  const onBoxDown = (e: RPointerEvent, b: CanvasBox) => {
    e.stopPropagation();
    if (connectMode) {
      if (!connect) {
        setConnect(b.id);
        setMsg(`From "${b.label}" — now tap the target box.`);
      } else if (connect !== b.id) {
        const arrow = newArrow(connect, b.id);
        patch({ arrows: [...doc.arrows, arrow] });
        setConnect(null);
        setSelected(arrow.id);
        setMsg('Arrow added. Pick a label for it below.');
      }
      return;
    }
    setSelected(b.id);
    const p = svgPoint(e);
    drag.current = { id: b.id, dx: p.x - b.x, dy: p.y - b.y, moved: false, before: doc };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const onMove = (e: RPointerEvent) => {
    if (!drag.current) return;
    const p = svgPoint(e);
    const { id, dx, dy } = drag.current;
    drag.current.moved = true;
    setDocLive({
      ...doc,
      boxes: doc.boxes.map((b) =>
        b.id === id ? { ...b, x: snap(Math.max(0, Math.min(W - b.w, p.x - dx)), snapOn), y: snap(Math.max(0, Math.min(H - b.h, p.y - dy)), snapOn) } : b,
      ),
    });
  };
  const onUp = () => {
    // One undo step per drag: the entry is the document as it was before the drag started.
    const d = drag.current;
    if (d?.moved) setHist((h) => commit({ ...h, present: d.before }, { ...h.present, updated: Date.now() }));
    drag.current = null;
  };

  const rename = () => {
    const box = doc.boxes.find((b) => b.id === selected);
    if (!box) return;
    const label = prompt('Box label', box.label);
    if (label !== null && label.trim()) patch({ boxes: doc.boxes.map((b) => (b.id === box.id ? { ...b, label: label.trim() } : b)) });
  };

  const labelArrow = (label: string) => {
    const arrow = doc.arrows.find((a) => a.id === selected);
    if (!arrow) return;
    patch({ arrows: doc.arrows.map((a) => (a.id === arrow.id ? { ...a, label } : a)) });
  };

  const del = () => {
    if (!selected) return;
    patch({ boxes: doc.boxes.filter((b) => b.id !== selected), arrows: doc.arrows.filter((a) => a.id !== selected && a.from !== selected && a.to !== selected) });
    setSelected(null);
  };

  const save = async () => {
    const name = prompt('Save as', doc.name);
    if (name === null) return;
    const d = { ...doc, name: name.trim() || doc.name, updated: Date.now() };
    setDocLive(d);
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
      load({ ...d, id: d.id || `c-${Date.now()}`, updated: Date.now() });
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
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
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

  // Keyboard: ctrl/cmd+z undo, ctrl/cmd+shift+z or ctrl+y redo, Delete removes the selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && /^(input|textarea)$/i.test(el.tagName)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setHist((h) => (e.shiftKey ? redo(h) : undo(h)));
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        setHist((h) => redo(h));
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected) del();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, doc]);

  const selectedArrow = doc.arrows.find((a) => a.id === selected);
  const selectedBox = doc.boxes.find((b) => b.id === selected);
  const canReveal = doc.boxes.length >= 3 && doc.arrows.length >= 1;

  const body = (
    <>
      {embedded && (
        <div className="flex items-center justify-between">
          <Muted>{doc.name}</Muted>
          <Button variant="ghost" onClick={save}>Save</Button>
        </div>
      )}

      {/* Palette */}
      <div>
        <Muted className="mb-1">Add a box</Muted>
        <Chips>
          {PALETTE.map((p) => (
            <Chip key={p} onClick={() => addBox(p)}>+ {p}</Chip>
          ))}
          <Chip onClick={() => { const l = prompt('Box label', 'Service'); if (l && l.trim()) addBox(l.trim()); }}>+ Custom…</Chip>
        </Chips>
      </div>

      {/* Tools */}
      <Chips>
        <Chip on={connectMode} onClick={() => { setConnectMode(!connectMode); setConnect(null); setMsg(connectMode ? '' : 'Connect: tap the source box, then the target box.'); }}>Connect</Chip>
        <Chip on={snapOn} onClick={() => setSnapOn(!snapOn)}>Snap to grid</Chip>
        <Button disabled={!hist.past.length} onClick={() => setHist(undo)}>↶ Undo</Button>
        <Button disabled={!hist.future.length} onClick={() => setHist(redo)}>↷ Redo</Button>
        <Button disabled={!selectedBox} onClick={rename}>Rename</Button>
        <Button variant="danger" disabled={!selected} onClick={del}>Delete</Button>
      </Chips>
      {selectedArrow && (
        <div>
          <Muted className="mb-1">Arrow label</Muted>
          <Chips>
            {ARROW_LABELS.map((l) => (
              <Chip key={l} on={selectedArrow.label === l} onClick={() => labelArrow(l)}>{l}</Chip>
            ))}
            <Chip onClick={() => { const l = prompt('Arrow label', selectedArrow.label ?? ''); if (l !== null) labelArrow(l.trim()); }}>custom…</Chip>
          </Chips>
        </div>
      )}
      {msg && <Muted>{msg}</Muted>}

      <div className="flex flex-col gap-3 min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_300px] min-[900px]:items-start">
        <div className="overflow-hidden rounded-2xl border border-line bg-white dark:border-[#2a2e38]" style={{ touchAction: 'none' }}>
          <Board svgRef={svgRef} doc={doc} selected={selected} connect={connect} snapOn={snapOn} onBoxDown={onBoxDown} onMove={onMove} onUp={onUp} onSelectArrow={setSelected} onBlank={() => { setSelected(null); if (connectMode) setConnect(null); }} />
        </div>

        {/* Notes side panel + talk-through */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-line p-3 dark:border-[#2a2e38]">
            <button className="flex w-full min-h-[44px] items-center justify-between font-semibold" onClick={() => setShowNotes((s) => !s)} aria-expanded={showNotes}>
              <span>Notes</span><span aria-hidden>{showNotes ? '▾' : '▸'}</span>
            </button>
            {showNotes && (
              <textarea
                className="mt-2 min-h-[160px] w-full rounded-xl border border-line bg-transparent p-2 text-[14px] dark:border-[#2a2e38]"
                placeholder="Requirements, estimates, the bottleneck, the trade-off…"
                value={doc.notes ?? ''}
                onChange={(e) => setDocLive({ ...doc, notes: e.target.value })}
                onBlur={() => setDoc(doc)}
              />
            )}
          </div>

          <div className="rounded-xl border border-line p-3 dark:border-[#2a2e38]">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Talk through it</span>
              {talk ? <Timer seconds={TALK_SECONDS} running={talk.running} onEnd={() => setTalk((t) => (t ? { ...t, running: false } : t))} big /> : <Muted>2 minutes</Muted>}
            </div>
            {!talk ? (
              <Button full className="mt-2" onClick={() => setTalk({ step: 0, running: true })}>Start the 2-minute walk-through</Button>
            ) : (
              <div className="mt-2">
                <ol className="m-0 list-none p-0 text-[13.5px]">
                  {TALK_PROMPTS.map((p, i) => (
                    <li key={p.title} className={`rounded-lg px-2 py-1 ${i === talk.step ? 'bg-warn-soft font-semibold dark:bg-[#2c2410]' : i < talk.step ? 'opacity-60' : 'opacity-40'}`}>
                      {i < talk.step ? '✓' : i === talk.step ? '▸' : '·'} {p.title}
                    </li>
                  ))}
                </ol>
                <Muted className="mt-2">{TALK_PROMPTS[talk.step].hint}</Muted>
                <Chips className="mt-2">
                  {talk.step < TALK_PROMPTS.length - 1 ? (
                    <Button variant="primary" onClick={() => setTalk({ ...talk, step: talk.step + 1 })}>Next: {TALK_PROMPTS[talk.step + 1].title}</Button>
                  ) : (
                    <Button variant="primary" onClick={() => setTalk(null)}>Done</Button>
                  )}
                  <Button variant="ghost" onClick={() => setTalk(null)}>Stop</Button>
                </Chips>
              </div>
            )}
          </div>
        </div>
      </div>

      <Chips>
        <Button onClick={exportPng}>Export PNG</Button>
        <Button onClick={exportJson}>Export JSON</Button>
        <Button onClick={() => fileRef.current?.click()}>Load JSON</Button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        <Button onClick={() => { load(newDoc()); setTemplateId(null); }}>New</Button>
      </Chips>

      {/* Templates with a hidden reference answer */}
      <Card>
        <Muted className="mb-2">Starter templates. Draw your own answer first; the reference unlocks once you have 3 boxes and an arrow.</Muted>
        <Chips>
          {TEMPLATES.map((t) => (
            <Chip key={t.id} on={templateId === t.id} onClick={() => { setTemplateId(t.id); load(templateStarter(t, snapOn)); setShowNotes(true); }}>{t.name}</Chip>
          ))}
        </Chips>
        {template && (
          <div className="mt-3">
            <div className="text-[14.5px]"><b>Brief:</b> {template.brief}</div>
            <div className="mt-2">
              {canReveal ? (
                <Reveal label="Show reference answer" hideLabel="Hide reference answer">
                  {reference && (
                    <div className="flex flex-col gap-2">
                      <div className="overflow-hidden rounded-xl border border-line bg-white dark:border-[#2a2e38]">
                        <Board doc={reference} readOnly />
                      </div>
                      <div className="whitespace-pre-wrap text-[13.5px]">{reference.notes}</div>
                      <Button onClick={() => { load({ ...reference, id: `c-${Date.now()}`, name: `${template.name} (reference)` }); }}>Copy the reference onto my canvas</Button>
                    </div>
                  )}
                </Reveal>
              ) : (
                <Muted>Reference answer stays hidden until you have drawn at least 3 boxes and 1 arrow.</Muted>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <Muted className="mb-2">Saved on this device</Muted>
        {canvases.length === 0 && <Muted>Nothing saved yet.</Muted>}
        <Chips>
          {canvases.map((c) => (
            <Chip key={c.id} on={c.id === doc.id} onClick={() => load(c)}>{c.name}</Chip>
          ))}
        </Chips>
        {canvases.some((c) => c.id === doc.id) && (
          <Button variant="danger" className="mt-3" onClick={async () => { if (confirm(`Delete "${doc.name}"?`)) { await removeCanvas(doc.id); load(newDoc()); } }}>
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

function center(b: CanvasBox) {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}
function edgePoint(from: CanvasBox, to: CanvasBox) {
  const c = center(from), t = center(to);
  const dx = t.x - c.x, dy = t.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const sx = from.w / 2 / Math.abs(dx || 1e-9), sy = from.h / 2 / Math.abs(dy || 1e-9);
  const s = Math.min(sx, sy);
  return { x: c.x + dx * s, y: c.y + dy * s };
}

function Board({
  svgRef, doc, selected = null, connect = null, snapOn = false, readOnly = false, onBoxDown, onMove, onUp, onSelectArrow, onBlank,
}: {
  svgRef?: React.Ref<SVGSVGElement>;
  doc: CanvasDoc;
  selected?: string | null;
  connect?: string | null;
  snapOn?: boolean;
  readOnly?: boolean;
  onBoxDown?: (e: RPointerEvent, b: CanvasBox) => void;
  onMove?: (e: RPointerEvent) => void;
  onUp?: () => void;
  onSelectArrow?: (id: string) => void;
  onBlank?: () => void;
}) {
  const markerId = readOnly ? 'arrowhead-ref' : 'arrowhead';
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerDown={onBlank}>
      <defs>
        <marker id={markerId} markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
          <path d="M0,0 L10,4 L0,8 z" fill="#1c1e24" />
        </marker>
        {snapOn && (
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#eceeea" strokeWidth="1" />
          </pattern>
        )}
      </defs>
      <rect width={W} height={H} fill="#ffffff" />
      {snapOn && <rect width={W} height={H} fill="url(#grid)" />}
      {doc.arrows.map((a: CanvasArrow) => {
        const from = doc.boxes.find((b) => b.id === a.from);
        const to = doc.boxes.find((b) => b.id === a.to);
        if (!from || !to) return null;
        const p1 = edgePoint(from, to), p2 = edgePoint(to, from);
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const sel = selected === a.id;
        return (
          <g key={a.id} onPointerDown={readOnly ? undefined : (e) => { e.stopPropagation(); onSelectArrow?.(a.id); }}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={28} />
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={sel ? '#1f8f4e' : '#1c1e24'} strokeWidth={sel ? 4 : 2.5} markerEnd={`url(#${markerId})`} strokeDasharray={a.label === 'async' || a.label === 'queue' ? '8 6' : undefined} />
            {a.label && (
              <g>
                <rect x={mid.x - a.label.length * 4.6 - 6} y={mid.y - 22} width={a.label.length * 9.2 + 12} height={20} rx={6} fill="#ffffff" stroke="#e2e3e0" />
                <text x={mid.x} y={mid.y - 8} fontSize={15} textAnchor="middle" fill="#1c1e24" fontFamily="system-ui, sans-serif">{a.label}</text>
              </g>
            )}
          </g>
        );
      })}
      {doc.boxes.map((b) => {
        const sel = selected === b.id || connect === b.id;
        return (
          <g key={b.id} onPointerDown={readOnly ? undefined : (e) => onBoxDown?.(e, b)} style={{ cursor: readOnly ? 'default' : 'grab' }}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={12} fill={sel ? '#e6f4ea' : '#f7f7f5'} stroke={sel ? '#1f8f4e' : '#1c1e24'} strokeWidth={sel ? 4 : 2.5} />
            <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 7} fontSize={20} textAnchor="middle" fill="#1c1e24" fontFamily="system-ui, sans-serif">
              {b.label.length > 16 ? `${b.label.slice(0, 15)}…` : b.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
