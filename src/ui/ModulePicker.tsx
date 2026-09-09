import { useMemo, useState } from 'react';
import { MODULES } from '../content/loader';
import { PHASES, phaseShort } from '../content/tracks';
import { Chip, Chips, Muted } from './primitives';

/**
 * Tap-only picker: phase chips, then module chips. No dropdowns anywhere.
 * onlyUnlocked hides modules without a lesson (drill / practice need cards).
 */
export function ModulePicker({
  value,
  onChange,
  onlyUnlocked = true,
  allLabel,
}: {
  value: string | undefined;
  onChange: (moduleId: string | undefined) => void;
  onlyUnlocked?: boolean;
  allLabel?: string;
}) {
  const current = MODULES.find((m) => m.id === value);
  const [phase, setPhase] = useState<number>(current?.phase ?? (allLabel ? 0 : 1));
  const inPhase = useMemo(() => MODULES.filter((m) => m.phase === phase), [phase]);

  return (
    <div className="flex flex-col gap-2">
      <Chips>
        {allLabel && (
          <Chip
            on={phase === 0}
            onClick={() => {
              setPhase(0);
              onChange(undefined);
            }}
          >
            {allLabel}
          </Chip>
        )}
        {PHASES.map((_, i) => {
          const p = i + 1;
          const any = MODULES.some((m) => m.phase === p && (!onlyUnlocked || m.status === 'unlocked'));
          return (
            <Chip key={p} on={phase === p} dim={!any} onClick={() => setPhase(p)}>
              {p}. {phaseShort(p)}
            </Chip>
          );
        })}
      </Chips>
      {phase > 0 && (
        <Chips>
          {inPhase.map((m) => {
            const ok = !onlyUnlocked || m.status === 'unlocked';
            return (
              <Chip key={m.id} on={value === m.id} dim={!ok} disabled={!ok} onClick={() => onChange(m.id)}>
                {m.title}
              </Chip>
            );
          })}
        </Chips>
      )}
      {phase > 0 && !inPhase.some((m) => !onlyUnlocked || m.status === 'unlocked') && (
        <Muted>Nothing unlocked in this phase yet.</Muted>
      )}
    </div>
  );
}
