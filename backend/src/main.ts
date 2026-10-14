import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { json, type Request } from "express";
import { AppModule } from "./app.module";
import { carregarVariaveisBackend, obterConfiguracaoSupabase, type ConfiguracaoSupabase } from "./env";

async function bootstrap() {
  await carregarVariaveisBackend();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({
    verify(request, _response, buffer) {
      (request as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    },
  }));
  app.setGlobalPrefix("api");
  app.enableCors({ origin: process.env.WEB_ORIGIN ? process.env.WEB_ORIGIN.split(",").map((origin) => origin.trim()) : ["http://localhost:3000", "http://127.0.0.1:3000"] });
  app.use("/api/supabase", async (request: any, response: any) => {
    let config: ConfiguracaoSupabase;
    try { config = obterConfiguracaoSupabase(); }
    catch { return response.status(503).json({ message: "Supabase não configurado no backend/.env." }); }
    const baseUrl = config.url.replace(/\/$/, "");
    const anonKey = config.anonKey;
    try {
      const path = request.originalUrl.replace(/^\/api\/supabase/, "");
      const headers: Record<string, string> = { apikey: anonKey };
      if (request.headers.authorization) headers.authorization = request.headers.authorization;
      if (request.headers["content-type"]) headers["content-type"] = request.headers["content-type"];
      if (request.headers.prefer) headers.prefer = request.headers.prefer;
      const upstream = await fetch(`${baseUrl}${path}`, {
        method: request.method,
        headers,
        ...(request.method === "GET" || request.method === "HEAD" ? {} : { body: request.rawBody ?? JSON.stringify(request.body ?? {}) }),
      });
      response.status(upstream.status);
      upstream.headers.forEach((value, key) => { if (["content-type", "content-range", "range-unit"].includes(key.toLowerCase())) response.setHeader(key, value); });
      response.send(request.method === "HEAD" ? undefined : Buffer.from(await upstream.arrayBuffer()));
    } catch {
      response.status(502).json({ message: "Falha ao comunicar com o serviço de dados." });
    }
  });
  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, process.env.HOST || "0.0.0.0");
  console.log(`API Renascer disponível em http://127.0.0.1:${port}/api`);
}

void bootstrap();
