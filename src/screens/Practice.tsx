import { useNavigate, useParams } from 'react-router-dom';
import { getModule, LESSONS } from '../content/loader';
import { Card, Empty, H2, Muted, Page } from '../ui/primitives';
import { ModulePicker } from '../ui/ModulePicker';
import { PracticeItem } from './ModuleScreen';

export function Practice() {
  const { moduleId } = useParams();
  const nav = useNavigate();
  const m = getModule(moduleId) ?? (moduleId ? undefined : undefined);
  const withTasks = LESSONS.filter((x) => x.practice.length > 0);

  return (
    <Page title="Practice">
      <Card>
        <Muted className="mb-2">Pick a module. Do the task on your machine, in a real editor, then check.</Muted>
        <ModulePicker value={moduleId} onChange={(id) => nav(id ? `/practice/${id}` : '/practice')} />
      </Card>
      {!m && (
        <Card>
          <Empty>
            {withTasks.length} modules have tasks. Tap one above.
          </Empty>
        </Card>
      )}
      {m && (
        <Card>
          <H2>{m.title}</H2>
          {m.practice.length === 0 && <Empty>No tasks in this module yet.</Empty>}
          <div className="flex flex-col gap-4">
            {m.practice.map((p, i) => (
              <PracticeItem key={i} index={i} task={p.task} hint={p.hint} solution={p.solution} why={p.why} />
            ))}
          </div>
        </Card>
      )}
    </Page>
  );
}
