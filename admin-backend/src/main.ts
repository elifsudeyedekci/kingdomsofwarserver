import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as compression from 'compression';

const WEAK = /(change|replace|secret|password|example|default|test|12345)/i;

/** Production refuses to start with weak / missing secrets or an unsafe CORS list: a misconfigured server must fail loudly, not run insecurely. */
export function assertProductionConfig(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV !== 'production') return;
  const problems: string[] = [];
  for (const k of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const v = env[k] ?? '';
    if (v.length < 64 || WEAK.test(v)) problems.push(`${k} must be at least 64 random characters (generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")`);
  }
  if (env.JWT_SECRET && env.JWT_SECRET === env.JWT_REFRESH_SECRET) problems.push('JWT_SECRET and JWT_REFRESH_SECRET must differ');
  if (env.ADMIN_JWT_SECRET && (env.ADMIN_JWT_SECRET.length < 64 || env.ADMIN_JWT_SECRET === env.JWT_SECRET)) problems.push('ADMIN_JWT_SECRET must be 64+ characters and differ from JWT_SECRET');
  const origins = (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origins.length || origins.some((o) => o === '*' || !o.startsWith('https://'))) problems.push('CORS_ORIGINS must list the https:// origin(s) of the panel (no wildcard, no http)');
  if (!env.DATABASE_URL || /kowpassword|password@/i.test(env.DATABASE_URL)) problems.push('DATABASE_URL must use a real, strong database password');
  if (problems.length) { console.error('[KoW Backend] Refusing to start in production:\n - ' + problems.join('\n - ')); process.exit(1); }
}

async function bootstrap() {
  assertProductionConfig(process.env);
  const isProd = process.env.NODE_ENV === 'production';
  // bodyParser is configured by hand below so the data editor may send big JSON files while every other route stays small
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  // Behind Nginx / Caddy / Cloudflare: TRUST_PROXY = number of proxy hops (so req.ip is the real client address, used by rate limits and the IP firewall)
  const hops = Number(process.env.TRUST_PROXY ?? 0);
  if (hops > 0) app.set('trust proxy', hops);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: isProd ? { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"], formAction: ["'none'"] } } : false,
      hsts: isProd ? { maxAge: 63_072_000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-site' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      frameguard: { action: 'deny' },
    }),
  );
  app.use(compression());

  app.use('/content', json({ limit: '10mb' }));
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ extended: false, limit: '64kb' }));

  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || origins.includes(origin)),      // game clients (no Origin header) are fine; browsers only from the listed panel origins
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  });

  // Global validation pipe - strip unknown props, reject unexpected ones, transform types
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }));

  // OpenAPI / Swagger: off in production unless SWAGGER_ENABLED=true (it documents every route)
  if (!isProd || process.env.SWAGGER_ENABLED === 'true') {
    const swaggerConfig = new DocumentBuilder().setTitle('Kingdoms of War API').setDescription('Backend API for Kingdoms of War: Mobile Empires').setVersion('0.1.0').addBearerAuth().build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`[KoW Backend] Running on port ${port}${isProd ? ' (production)' : ''}`);
}

bootstrap();
