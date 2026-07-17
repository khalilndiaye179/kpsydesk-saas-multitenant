import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── CORS ──────────────────────────────────────────────────────────────
  // En développement  : accepte localhost:3011 (Vite) et toutes les origines locales
  // En production     : liste blanche basée sur CORS_ORIGINS (env var)
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    app.enableCors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.some((allowed) => origin.endsWith(allowed))) {
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
