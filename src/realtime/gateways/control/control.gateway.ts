import { Namespace } from "socket.io";
import { ControlSocket } from "./control.types";

export function setupControl(namespace: Namespace) {
  namespace.on("connection", (socket: ControlSocket) => {
    try {
      const { user } = socket.data;
      console.log("WELCOME TO CONTROLS : ", user);
    } catch (error) {}
  });
}
