import { useParams } from 'react-router-dom';
import { MODULES, modulesInTrack } from '../content/loader';
import { TRACKS, TRACK_ORDER, phaseName, type TrackId } from '../content/tracks';
import { useMastery, trackMastery } from '../store/derive';
import { ListRow, Muted, Page, Pill, masteryTone, Empty, Card } from '../ui/primitives';

export function Learn() {
  const mastery = useMastery();
  return (
    <Page title="Learn">
      <Muted>Tracks → modules. Locked modules show a preview; ask Claude to teach a topic and it unlocks here. ★ marks modules inside the 60-day window.</Muted>
      <div className="flex flex-col gap-1.5">
        {TRACK_ORDER.map((t) => {
          const mods = MODULES.filter((m) => m.track === t);
          const unlocked = mods.filter((m) => m.status === 'unlocked').length;
          const tm = trackMastery(t, mastery);
          return (
            <ListRow
              key={t}
              to={`/learn/${t}`}
              right={
                <span className="flex items-center gap-1.5">
                  {tm !== null && <Pill tone={masteryTone(tm)}>{tm}%</Pill>}
                  <Muted>{unlocked}/{mods.length}</Muted>
                </span>
              }
            >
              <span className={mods.length ? '' : 'opacity-50'}>{TRACKS[t]}</span>
              {!mods.length && <Muted>no modules yet</Muted>}
            </ListRow>
          );
        })}
      </div>
    </Page>
  );
}

export function TrackScreen() {
  const { track } = useParams();
  const mastery = useMastery();
  const name = TRACKS[track as TrackId];
  if (!name) return <Page back="/learn" title="Unknown track"><Empty>No such track.</Empty></Page>;
  const mods = modulesInTrack(track!);
  return (
    <Page back="/learn" title={name}>
      {mods.length === 0 && (
        <Card>
          <Empty>No modules in this track yet. They arrive as content files after mentoring sessions.</Empty>
        </Card>
      )}
      <div className="flex flex-col gap-1.5">
        {mods.map((m) => {
          const pct = mastery[m.id];
          const pill =
            m.status === 'preview' ? (
              <Pill>locked</Pill>
            ) : pct === null || pct === 0 ? (
              <Pill>not drilled</Pill>
            ) : (
              <Pill tone={masteryTone(pct)}>{pct}%</Pill>
            );
          return (
            <ListRow key={m.id} to={`/learn/${m.track}/${m.id}`} right={pill}>
              <span className={m.status === 'preview' ? 'opacity-70' : ''}>
                {m.star && <span className="mr-1 text-warn" title="In the 60-day window" aria-label="starred">★</span>}
                {m.title}
              </span>
              <Muted>{phaseName(m.phase)}</Muted>
            </ListRow>
          );
        })}
      </div>
    </Page>
  );
}
