import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MODULES } from '../../content/loader';
import { useStore } from '../../store/Store';
import { Card, Empty, Muted, Page } from '../../ui/primitives';

export function Glossary() {
  const { settings } = useStore();
  const [q, setQ] = useState('');
  const entries = useMemo(
    () =>
      MODULES.flatMap((m) => m.glossary.map((g) => ({ ...g, moduleId: m.id, moduleTitle: m.title, track: m.track }))).sort((a, b) =>
        a.term.localeCompare(b.term),
      ),
    [],
  );
  const shown = entries.filter((e) => !q || `${e.term} ${e.plain}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <Page back="/more" title="Glossary">
      <input
        className="w-full rounded-xl border border-line bg-white p-3 text-[15px] dark:border-[#2a2e38] dark:bg-[#171a21]"
        placeholder="Search a term…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {entries.length === 0 && (
        <Card>
          <Empty>No glossary terms yet. They arrive inside module files as topics are taught.</Empty>
        </Card>
      )}
      {shown.map((e, i) => (
        <Card key={`${e.moduleId}-${i}`}>
          <div className="font-semibold">{e.term}</div>
          <div className="text-[15px]">{e.plain}</div>
          {settings.lang === 'en-bn' && e.bn && <div className="bn mt-1 text-[15px]">{e.bn}</div>}
          <Muted className="mt-1">
            <Link to={`/learn/${e.track}/${e.moduleId}`} className="text-accent">{e.moduleTitle} →</Link>
          </Muted>
        </Card>
      ))}
    </Page>
  );
}
