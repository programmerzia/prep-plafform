import { useParams } from 'react-router-dom';
import { MODULES, modulesInTrack } from '../../content/loader';
import { TRACKS, TRACK_ORDER, type TrackId } from '../../content/tracks';
import { useStore } from '../../store/Store';
import { Markdown } from '../../ui/Markdown';
import { Button, Card, CodeBlock, Empty, H3, ListRow, Muted, Page } from '../../ui/primitives';

export function CheatSheets() {
  return (
    <Page back="/more" title="Cheat sheets">
      <Muted>One page per track, built from the modules that have a lesson: the hook, the analogy, the code, every drill card. Print from the page.</Muted>
      <div className="flex flex-col gap-1.5">
        {TRACK_ORDER.map((t) => {
          const n = MODULES.filter((m) => m.track === t && m.lesson).length;
          if (!n) return null;
          return (
            <ListRow key={t} to={`/more/cheatsheets/${t}`} right={<Muted>{n} modules</Muted>}>
              {TRACKS[t]}
            </ListRow>
          );
        })}
      </div>
    </Page>
  );
}

export function CheatSheet() {
  const { track } = useParams();
  const { settings } = useStore();
  const name = TRACKS[track as TrackId];
  const mods = modulesInTrack(track ?? '').filter((m) => m.lesson);
  if (!name) return <Page back="/more/cheatsheets" title="Unknown track"><Empty>No such track.</Empty></Page>;
  return (
    <Page back="/more/cheatsheets" title={`${name} — cheat sheet`} actions={<Button className="no-print" onClick={() => window.print()}>Print</Button>}>
      {mods.map((m) => (
        <Card key={m.id} className="print:break-inside-avoid">
          <h2 className="text-lg font-semibold">{m.title}</h2>
          {m.lesson?.hook && <p className="font-medium">{m.lesson.hook}</p>}
          {m.lesson?.picture && <Markdown text={m.lesson.picture} className="text-[14.5px] text-neutral-600 dark:text-neutral-300" />}
          {m.lesson?.right && (
            <>
              <H3>Code</H3>
              <CodeBlock code={m.lesson.right.code} lang={m.lesson.right.lang} />
            </>
          )}
          <H3>Cards</H3>
          <dl className="text-[14px]">
            {m.cards.map((c, i) => (
              <div key={i} className="mb-2">
                <dt className="font-medium">{c.q}</dt>
                <dd className="text-neutral-600 dark:text-neutral-300">{c.a}</dd>
              </div>
            ))}
          </dl>
          {settings.lang === 'en-bn' && m.lesson?.bn && <div className="bn mt-2 text-[14px]">{m.lesson.bn}</div>}
        </Card>
      ))}
    </Page>
  );
}
