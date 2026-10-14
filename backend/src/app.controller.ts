import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  index() {
    return { service: "renascer-api", status: "ok", health: "/api/health" };
  }

  @Get("health")
  health() {
    return { status: "ok", service: "renascer-api" };
  }
}
