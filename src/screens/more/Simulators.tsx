import { Suspense } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MODULE_BY_ID } from '../../content/loader';
import { SIMULATORS, SIM_LIST, PLANNED_SIMULATORS } from '../../simulators';
import { hitRate } from '../../simulators/kit/stats';
import { useStore } from '../../store/Store';
import { Card, Empty, ListRow, Muted, Page, Pill } from '../../ui/primitives';

export function Simulators() {
  const { simStats } = useStore();
  return (
    <Page back="/more" title="Simulators">
      <Muted>Free play. Each one teaches a single idea: predict, watch it break, then watch the fix.</Muted>
      <div className="flex flex-col gap-1.5">
        {SIM_LIST.map((s) => {
          const rate = hitRate(simStats[s.id]);
          return (
            <ListRow key={s.id} to={`/more/simulators/${s.id}`} right={rate === null ? <Pill>new</Pill> : <Pill tone={rate >= 60 ? 'done' : 'mid'}>{rate}% predicted</Pill>}>
              <div>{s.title}</div>
              <Muted>{s.story}</Muted>
            </ListRow>
          );
        })}
      </div>
      {PLANNED_SIMULATORS.length > 0 && (
        <Card>
          <Muted>Coming next: {PLANNED_SIMULATORS.join(', ')}.</Muted>
        </Card>
      )}
    </Page>
  );
}

export function SimulatorScreen() {
  const { id } = useParams();
  const Sim = id ? SIMULATORS[id] : undefined;
  const meta = SIM_LIST.find((s) => s.id === id);
  const mod = meta?.moduleId ? MODULE_BY_ID[meta.moduleId] : undefined;
  if (!Sim || !meta) return <Page back="/more/simulators" title="Simulator"><Empty>No such simulator.</Empty></Page>;
  return (
    <Page back="/more/simulators" title={meta.title}>
      <Card>
        <Suspense fallback={<Muted>Loading simulator…</Muted>}>
          <Sim />
        </Suspense>
      </Card>
      {mod && (
        <Muted>
          Lesson: <Link to={`/learn/${mod.track}/${mod.id}`} className="text-accent">{mod.title} →</Link>
        </Muted>
      )}
    </Page>
  );
}
