import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { UsuariosController } from "./usuarios.controller";

@Module({ controllers: [AppController, UsuariosController] })
export class AppModule {}
