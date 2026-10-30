import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { MissingNightError, readNight } from './digest/types.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/api/digest/:night', (c) => {
    try {
      return c.json(readNight(config.runsDir, c.req.param('night')));
    } catch (error) {
      if (!(error instanceof MissingNightError)) throw error;
      return c.json({ error: 'not found' }, 404);
    }
  });

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    try {
      const digest = readNight(config.runsDir, night);
      return c.html(
        <Layout title="digest" lane={lane()}>
          <DigestPage night={night} digest={digest} />
        </Layout>,
      );
    } catch (error) {
      if (!(error instanceof MissingNightError)) throw error;
      return c.html(
        <Layout title="digest" lane={lane()}>
          <h1>digest · {night}</h1>
          <p class="mute">no run log</p>
        </Layout>,
        404,
      );
    }
  });

  return app;
}
