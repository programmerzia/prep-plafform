import { useRef, useState } from 'react';
import { callLLM, PROVIDERS } from '../../ai/providers';
import { useStore } from '../../store/Store';
import type { ExportBundle, Provider } from '../../store/types';
import { Button, Card, Chip, Chips, H2, Muted, Page } from '../../ui/primitives';

export function Settings() {
  const { settings, updateSettings, exportBundle, importBundle, resetProgress } = useStore();
  const [key, setKey] = useState(settings.ai.key);
  const [model, setModel] = useState(settings.ai.model);
  const [testOut, setTestOut] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const P = PROVIDERS[settings.ai.provider];

  const saveAi = async () => {
    await updateSettings({ ai: { ...settings.ai, key: key.trim(), model: model.trim() } });
    setTestOut('Saved.');
  };
  const testAi = async () => {
    await saveAi();
    setTestOut('Testing…');
    try {
      const r = await callLLM({ ...settings.ai, key: key.trim(), model: model.trim() }, 'Reply with exactly: OK', [{ role: 'user', content: 'ping' }]);
      setTestOut(/OK/i.test(r) ? 'Connected ✓' : `Replied: ${r.slice(0, 40)}`);
    } catch (e) {
      setTestOut(`Failed: ${(e as Error).message}`);
    }
  };

  const doExport = () => {
    const data = JSON.stringify(exportBundle(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `prep-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = async (file: File) => {
    try {
      const b = JSON.parse(await file.text()) as ExportBundle;
      if (!confirm('Replace everything on this device with the file? This cannot be undone.')) return;
      await importBundle(b);
      setMsg('Imported.');
    } catch (e) {
      setMsg(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <Page back="/more" title="Settings">
      <Card>
        <H2>Language</H2>
        <Chips>
          <Chip on={settings.lang === 'en'} onClick={() => updateSettings({ lang: 'en' })}>EN</Chip>
          <Chip on={settings.lang === 'en-bn'} onClick={() => updateSettings({ lang: 'en-bn' })}>EN + BN</Chip>
        </Chips>
        <Muted className="mt-2">EN + BN shows the Bangla summary wherever a summary appears.</Muted>
      </Card>

      <Card>
        <H2>Interviewer</H2>
        <Muted className="mb-2">Built-in questions are the default and always work. Connecting an AI provider is optional: it asks fresh questions and grades your answer.</Muted>
        <Muted className="mb-1">Interviewer</Muted>
        <Chips>
          {(Object.keys(PROVIDERS) as Provider[]).map((k) => (
            <Chip key={k} on={settings.ai.provider === k} onClick={() => updateSettings({ ai: { ...settings.ai, provider: k } })}>
              {PROVIDERS[k].name}
            </Chip>
          ))}
        </Chips>
        <Muted className="mt-2">{P.help}</Muted>
        {P.url && (
          <div className="mt-3 flex flex-col gap-2">
            <input
              type="password"
              className="w-full rounded-xl border border-line bg-transparent p-3 text-[15px] dark:border-[#2a2e38]"
              placeholder="Paste your API key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
            <input
              className="w-full rounded-xl border border-line bg-transparent p-3 text-[15px] dark:border-[#2a2e38]"
              placeholder={`Model (default: ${P.model})`}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button variant="primary" onClick={saveAi}>Save</Button>
              <Button onClick={testAi}>Test</Button>
              <Muted>{testOut}</Muted>
            </div>
            <Muted>Your key stays in this browser only. Free tiers: Gemini (no card) or Groq (30 req/min). Create the key yourself on the provider's site.</Muted>
          </div>
        )}
      </Card>

      <Card>
        <H2>Backup</H2>
        <Muted className="mb-2">Progress, stories, notes and canvases as one JSON file. The API key is never included.</Muted>
        <Chips>
          <Button onClick={doExport}>Export progress</Button>
          <Button onClick={() => fileRef.current?.click()}>Import progress</Button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
        </Chips>
        {msg && <Muted className="mt-2">{msg}</Muted>}
      </Card>

      <Card>
        <H2>Danger zone</H2>
        <Button
          variant="danger"
          onClick={async () => {
            if (confirm('Reset all drill progress, streak and history on this device? Stories, notes and canvases are kept.')) {
              await resetProgress();
              setMsg('Progress reset.');
            }
          }}
        >
          Reset all progress
        </Button>
      </Card>
    </Page>
  );
}
