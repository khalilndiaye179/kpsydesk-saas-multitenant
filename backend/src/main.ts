import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.originalUrl}`);
    next();
  });

  // Servir statiquement le dossier des uploads (ex: logos des tenants)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // ── CORS ──────────────────────────────────────────────────────────────
  // En développement  : accepte localhost:3011 (Vite) et toutes les origines locales
  // En production     : liste blanche basée sur CORS_ORIGINS (env var)
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    if (allowedOrigins.length === 0) {
      console.error('FATAL ERROR: CORS_ORIGINS environment variable is empty or not set in production. Application will not start to prevent CORS vulnerability.');
      process.exit(1);
    }

    app.enableCors({
      origin: (origin, callback) => {
        // En production, on exige une origine valide, sauf si l'origine est nulle (ex: curl/postman) qu'on accepte souvent, 
        // ou on peut aussi forcer !origin à être rejeté si on veut être très strict, 
        // mais le comportement standard de l'app était d'accepter !origin.
        // Ici, on remplace endsWith par === pour une comparaison stricte.
        if (!origin || allowedOrigins.some((allowed) => origin === allowed)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS refusé pour l'origine: ${origin}`));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
      credentials: true,
    });
  } else {
    // Dev : permissif mais en listant explicitement le header X-Tenant-ID
    app.enableCors({
      origin: true, // Tout accepter en dev
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
      credentials: true,
    });
  }

  // ── Préfixe global ──────────────────────────────────────────────────
  app.setGlobalPrefix('api');

  // ── Démarrage ────────────────────────────────────────────────────────
  const port = process.env.PORT || 3010;
  await app.listen(port);
  console.log(`\n✅ API Inventaire Parc Informatique démarrée`);
  console.log(`   PORT    : ${port}`);
  console.log(`   MODE    : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   BASE URL: http://localhost:${port}/api\n`);
}

bootstrap();
