import { ALL_CARDS, MODULE_BY_ID, UNLOCKED } from '../../content/loader';
import { FUNNELS, TRACKS, TRACK_ORDER, type FunnelId } from '../../content/tracks';
import { useStore } from '../../store/Store';
import { trackMastery, useMastery } from '../../store/derive';
import { Bar, Big, Card, Empty, H2, Muted, Page, Pill, masteryTone } from '../../ui/primitives';

export function Progress() {
  const { cards, history } = useStore();
  const mastery = useMastery();
  const seen = ALL_CARDS.filter((c) => cards[c.key]?.seen).length;
  const longTerm = ALL_CARDS.filter((c) => (cards[c.key]?.box ?? 0) >= 3).length;
  const interviews = history.filter((h) => h.type === 'interview' && h.score !== null);
  const avg = interviews.length
    ? (interviews.reduce((s, h) => s + (h.type === 'interview' ? h.score ?? 0 : 0), 0) / interviews.length).toFixed(1)
    : '–';
  const mocks = history.filter((h) => h.type === 'mock').slice(-8).reverse();

  return (
    <Page back="/more" title="Progress">
      <Card>
        <H2>Overall</H2>
        <div className="flex justify-between">
          <div><Big>{seen}/{ALL_CARDS.length}</Big><Muted>cards touched</Muted></div>
          <div><Big>{longTerm}</Big><Muted>in long-term box</Muted></div>
          <div><Big>{avg}</Big><Muted>avg interview</Muted></div>
        </div>
      </Card>

      <Card>
        <H2>Mastery per track</H2>
        {TRACK_ORDER.map((t) => {
          const tm = trackMastery(t, mastery);
          if (tm === null) return null;
          return (
            <div key={t} className="my-2">
              <div className="flex justify-between text-[15px]">
                <span>{TRACKS[t]}</span>
                <Muted>{tm}%</Muted>
              </div>
              <Bar pct={tm} />
            </div>
          );
        })}
      </Card>

      <Card>
        <H2>By module</H2>
        {UNLOCKED.map((m) => (
          <div key={m.id} className="my-2">
            <div className="flex justify-between text-[15px]">
              <span>{m.title}</span>
              <Pill tone={masteryTone(mastery[m.id])}>{mastery[m.id] ?? 0}%{(mastery[m.id] ?? 0) >= 60 ? ' ✓' : ''}</Pill>
            </div>
            <Bar pct={mastery[m.id] ?? 0} />
          </div>
        ))}
      </Card>

      <Card>
        <H2>Mock history</H2>
        {mocks.length === 0 && <Empty>No mocks yet.</Empty>}
        {mocks.map((h, i) =>
          h.type === 'mock' ? (
            <div key={i} className="flex justify-between py-1 text-[15px]">
              <span>{FUNNELS[h.funnel as FunnelId]?.name ?? h.funnel}</span>
              <Pill tone={h.score >= 7 ? 'done' : h.score >= 5 ? 'mid' : 'weak'}>{h.score}/10</Pill>
            </div>
          ) : null,
        )}
      </Card>

      <Card>
        <H2>Recent interviews</H2>
        {interviews.length === 0 && <Empty>None yet.</Empty>}
        {interviews.slice(-8).reverse().map((h, i) =>
          h.type === 'interview' ? (
            <div key={i} className="flex justify-between py-1 text-[15px]">
              <span>{MODULE_BY_ID[h.moduleId]?.title ?? h.moduleId}</span>
              <Pill tone={(h.score ?? 0) >= 7 ? 'done' : (h.score ?? 0) >= 5 ? 'mid' : 'weak'}>{h.score}/10</Pill>
            </div>
          ) : null,
        )}
      </Card>
    </Page>
  );
}
