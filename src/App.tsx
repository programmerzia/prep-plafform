import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { StoreProvider, useStore } from './store/Store';
import { TabBar } from './ui/TabBar';
import { Today } from './screens/Today';
import { Learn, TrackScreen } from './screens/Learn';
import { ModuleScreen } from './screens/ModuleScreen';
import { Practice } from './screens/Practice';
import { Drill } from './screens/Drill';
import { Interview } from './screens/Interview';
import { Mock } from './screens/Mock';
import { More } from './screens/more/More';
import { Canvas } from './screens/more/Canvas';
import { Stories } from './screens/more/Stories';
import { CheatSheets, CheatSheet } from './screens/more/CheatSheets';
import { Glossary } from './screens/more/Glossary';
import { Progress } from './screens/more/Progress';
import { Settings } from './screens/more/Settings';

function Shell() {
  const { ready } = useStore();
  if (!ready) return <div className="p-6 text-center text-neutral-500">Loading…</div>;
  return (
    <>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/learn/:track" element={<TrackScreen />} />
        <Route path="/learn/:track/:moduleId" element={<ModuleScreen />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/practice/:moduleId" element={<Practice />} />
        <Route path="/drill" element={<Drill />} />
        <Route path="/interview" element={<Interview />} />
        <Route path="/mock" element={<Mock />} />
        <Route path="/more" element={<More />} />
        <Route path="/more/canvas" element={<Canvas />} />
        <Route path="/more/stories" element={<Stories />} />
        <Route path="/more/cheatsheets" element={<CheatSheets />} />
        <Route path="/more/cheatsheets/:track" element={<CheatSheet />} />
        <Route path="/more/glossary" element={<Glossary />} />
        <Route path="/more/progress" element={<Progress />} />
        <Route path="/more/settings" element={<Settings />} />
        <Route path="*" element={<Today />} />
      </Routes>
      <TabBar />
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Shell />
      </BrowserRouter>
    </StoreProvider>
  );
}
