
import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';

const app = Fastify({
  logger: true,
});

type Monitor = {
  id: string;
  name: string;
  url: string;
  createdAt: string;
};

type CheckResult = {
  id: string;
  monitorId: string;
  checkedAt: string;
  status: 'up' | 'down';
  statusCode: number | null;
  responseTimeMs: number;
  error?: string;
};

type CreateMonitorBody = {
  name: string;
  url: string;
};

type MonitorParams = {
  id: string;
};

const monitors: Monitor[] = [];
const history: CheckResult[] = [];

// 1. ตรวจสอบสุขภาพของ PulseCheck เอง
app.get('/health', async () => {
  return {
    status: 'ok',
    service: 'PulseCheck',
    timestamp: new Date().toISOString(),
  };
});

// 2. ลงทะเบียนบริการที่ต้องการตรวจสอบ
app.post<{ Body: CreateMonitorBody }>(
  '/monitors',
  {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'url'],
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 80 },
          url: { type: 'string', minLength: 1, maxLength: 2048 },
        },
      },
    },
  },
  async (request, reply) => {
    const name = request.body.name.trim();

    if (!name) {
      return reply.code(400).send({
        error: 'name must not be empty',
      });
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(request.body.url);
    } catch {
      return reply.code(400).send({
        error: 'Invalid URL',
      });
    }

    if (
      !['http:', 'https:'].includes(parsedUrl.protocol) ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return reply.code(400).send({
        error: 'URL must use HTTP or HTTPS without embedded credentials',
      });
    }

    const monitor: Monitor = {
      id: randomUUID(),
      name,
      url: parsedUrl.toString(),
      createdAt: new Date().toISOString(),
    };

    monitors.push(monitor);

    return reply.code(201).send(monitor);
  },
);

// 3. ดูรายการบริการทั้งหมด
app.get('/monitors', async () => {
  return monitors;
});

// 4. สั่งตรวจสอบบริการตาม ID
app.post<{ Params: MonitorParams }>(
  '/monitors/:id/check',
  async (request, reply) => {
    const monitor = monitors.find(
      (item) => item.id === request.params.id,
    );

    if (!monitor) {
      return reply.code(404).send({
        error: 'Monitor not found',
      });
    }

    const startedAt = Date.now();

    let status: CheckResult['status'] = 'down';
    let statusCode: number | null = null;
    let error: string | undefined;

    try {
      const response = await fetch(monitor.url, {
        signal: AbortSignal.timeout(5000),
        redirect: 'manual',
      });

      statusCode = response.status;
      status = response.ok ? 'up' : 'down';

      if (!response.ok) {
        error = `HTTP ${response.status}`;
      }

      await response.body?.cancel();
    } catch (err) {
      status = 'down';
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const result: CheckResult = {
      id: randomUUID(),
      monitorId: monitor.id,
      checkedAt: new Date().toISOString(),
      status,
      statusCode,
      responseTimeMs: Date.now() - startedAt,
      ...(error ? { error } : {}),
    };

    history.push(result);

    request.log.info(
      {
        monitorId: monitor.id,
        status: result.status,
        responseTimeMs: result.responseTimeMs,
      },
      'Monitor check completed',
    );

    return result;
  },
);

// 5. ดูประวัติการตรวจสอบของบริการ
app.get<{ Params: MonitorParams }>(
  '/monitors/:id/history',
  async (request, reply) => {
    const monitor = monitors.find(
      (item) => item.id === request.params.id,
    );

    if (!monitor) {
      return reply.code(404).send({
        error: 'Monitor not found',
      });
    }

    return history.filter(
      (result) => result.monitorId === monitor.id,
    );
  },
);

// 6. เริ่มเซิร์ฟเวอร์
const start = async () => {
  try {
    await app.listen({
      port: 3000,
      host: '127.0.0.1',
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  void start();
}

export { app };