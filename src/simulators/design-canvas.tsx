import { CanvasEditor } from '../screens/more/Canvas';

/** Simulator id "design-canvas": the same editor as More → Design canvas, embedded in a lesson. */
export default function DesignCanvasSimulator() {
  return <CanvasEditor embedded />;
}
