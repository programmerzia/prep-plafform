import { useEffect, useState } from 'react';
import { useStore } from '../../store/Store';
import type { Story } from '../../store/types';
import { Button, Card, Chip, Chips, Empty, H2, H3, Muted, Page } from '../../ui/primitives';

const EMPTY: Story = { id: '', title: '', situation: '', task: '', action: '', result: '', long: '', short: '', updated: 0 };

export function Stories() {
  const { stories, saveStory, removeStory } = useStore();
  const [editing, setEditing] = useState<Story | null>(null);
  const [rehearse, setRehearse] = useState<Story | null>(null);

  if (rehearse) return <Rehearsal story={rehearse} onClose={() => setRehearse(null)} />;

  if (editing) {
    const set = (k: keyof Story, v: string) => setEditing({ ...editing, [k]: v });
    const field = (k: keyof Story, label: string, rows = 3) => (
      <label className="block">
        <Muted className="mb-1">{label}</Muted>
        <textarea
          rows={rows}
          className="w-full rounded-xl border border-line bg-transparent p-3 text-[15px] dark:border-[#2a2e38]"
          value={editing[k] as string}
          onChange={(e) => set(k, e.target.value)}
        />
      </label>
    );
    return (
      <Page back="/more" title={editing.id ? 'Edit story' : 'New story'}>
        <Card>
          <label className="block">
            <Muted className="mb-1">Title (e.g. "The Norwegian contract")</Muted>
            <input className="w-full rounded-xl border border-line bg-transparent p-3 text-[15px] dark:border-[#2a2e38]" value={editing.title} onChange={(e) => set('title', e.target.value)} />
          </label>
          <H3>STAR</H3>
          <div className="flex flex-col gap-3">
            {field('situation', 'Situation — where were you, what was at stake')}
            {field('task', 'Task — what was yours to solve')}
            {field('action', 'Action — the decision you made and why', 4)}
            {field('result', 'Result — numbers, what changed, what you learned')}
          </div>
          <H3>Spoken versions</H3>
          <div className="flex flex-col gap-3">
            {field('long', '2-minute version (about 250 words)', 8)}
            {field('short', '30-second version (about 70 words)', 4)}
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              variant="primary"
              className="flex-1"
              disabled={!editing.title.trim()}
              onClick={async () => {
                await saveStory({ ...editing, id: editing.id || `s-${Date.now()}`, updated: Date.now() });
                setEditing(null);
              }}
            >
              Save
            </Button>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </Card>
      </Page>
    );
  }

  return (
    <Page back="/more" title="Stories">
      <Muted>Five true stories you can tell from memory. Rehearsal mode hides the text after 3 seconds so you speak, not read.</Muted>
      <Button variant="primary" onClick={() => setEditing({ ...EMPTY })}>+ New story</Button>
      {stories.length === 0 && (
        <Card>
          <Empty>No stories yet. Start with: the Norwegian contract, CoreBari, PHP → .NET, back to Laravel.</Empty>
        </Card>
      )}
      {stories.map((s) => (
        <Card key={s.id}>
          <H2>{s.title}</H2>
          <Muted>{s.long ? `${s.long.split(/\s+/).filter(Boolean).length} words (2-min)` : 'no 2-min version yet'} · {s.short ? `${s.short.split(/\s+/).filter(Boolean).length} words (30-sec)` : 'no 30-sec version yet'}</Muted>
          <Chips className="mt-3">
            <Button variant="primary" onClick={() => setRehearse(s)} disabled={!s.long && !s.short}>Rehearse</Button>
            <Button onClick={() => setEditing(s)}>Edit</Button>
            <Button variant="danger" onClick={() => { if (confirm(`Delete "${s.title}"?`)) removeStory(s.id); }}>Delete</Button>
          </Chips>
        </Card>
      ))}
    </Page>
  );
}

function Rehearsal({ story, onClose }: { story: Story; onClose: () => void }) {
  const [version, setVersion] = useState<'long' | 'short'>(story.long ? 'long' : 'short');
  const [visible, setVisible] = useState(true);
  const [round, setRound] = useState(0);
  const text = story[version];

  useEffect(() => {
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(id);
  }, [version, round]);

  return (
    <Page title={story.title} actions={<Button variant="ghost" onClick={onClose}>Close</Button>}>
      <Chips>
        <Chip on={version === 'long'} disabled={!story.long} onClick={() => setVersion('long')}>2 minutes</Chip>
        <Chip on={version === 'short'} disabled={!story.short} onClick={() => setVersion('short')}>30 seconds</Chip>
      </Chips>
      <Card>
        <Muted className="mb-2">{visible ? 'Read it once. It disappears in 3 seconds.' : 'Now say it out loud from memory.'}</Muted>
        <div className={`min-h-[160px] whitespace-pre-wrap text-[16px] transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0 select-none'}`}>
          {text}
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={() => setRound((r) => r + 1)}>Show again for 3 s</Button>
          <Button variant="ghost" onClick={() => setVisible((v) => !v)}>{visible ? 'Hide now' : 'Peek'}</Button>
        </div>
      </Card>
      {story.situation && (
        <Card>
          <Muted>STAR skeleton (stays visible)</Muted>
          <ul className="mt-1 list-disc pl-5 text-[14.5px]">
            <li><b>S</b> {story.situation.slice(0, 80)}{story.situation.length > 80 ? '…' : ''}</li>
            <li><b>T</b> {story.task.slice(0, 80)}{story.task.length > 80 ? '…' : ''}</li>
            <li><b>A</b> {story.action.slice(0, 80)}{story.action.length > 80 ? '…' : ''}</li>
            <li><b>R</b> {story.result.slice(0, 80)}{story.result.length > 80 ? '…' : ''}</li>
          </ul>
        </Card>
      )}
    </Page>
  );
}
