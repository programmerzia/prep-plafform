import { ListRow, Muted, Page } from '../../ui/primitives';

const ITEMS = [
  { to: '/more/canvas', label: 'Design canvas', hint: 'Boxes and arrows for system design answers' },
  { to: '/more/stories', label: 'Stories', hint: 'STAR stories, 2-minute and 30-second versions' },
  { to: '/more/cheatsheets', label: 'Cheat sheets', hint: 'One printable page per track' },
  { to: '/more/glossary', label: 'Glossary', hint: 'Term, plain meaning, Bangla' },
  { to: '/more/progress', label: 'Progress', hint: 'Mastery per track, mock history' },
  { to: '/more/settings', label: 'Settings', hint: 'AI provider, language, backup' },
];

export function More() {
  return (
    <Page title="More">
      <div className="flex flex-col gap-1.5">
        {ITEMS.map((it) => (
          <ListRow key={it.to} to={it.to} right={<span className="text-neutral-400">›</span>}>
            <div>{it.label}</div>
            <Muted>{it.hint}</Muted>
          </ListRow>
        ))}
      </div>
    </Page>
  );
}
