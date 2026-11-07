import { runSim } from "./sim";
import type { AppData } from "./types";

self.onmessage = (e: MessageEvent<{ job: number; data: AppData }>) => {
  const result = runSim(e.data.data, 3000);
  (self as unknown as Worker).postMessage({ job: e.data.job, result });
};
