# Dingdinghousev2-express

dingding backend in express

# node-server-project/node-server-project/README.md

# Project Structure

```
project/
├── server.ts
├── src/
│   ├── common/
│   │   ├── config/
│   │   │   ├── cloudinary.ts
│   │   │   ├── config.ts
│   │   │   └── db.ts
│   │   │   └── redis.ts
│   │   ├── lib/
│   │   │   ├── default-permissions.ts
│   │   │   ├── default-role-hierarchy.ts
│   │   │   ├── resources.ts
│   │   │   ├── response.ts
│   │   │   └── utils.ts
│   │   ├── schemas/
│   │   │   ├── game.schema.ts
│   │   │   ├── payout.schema.ts
│   │   │   ├── role.schema.ts
│   │   │   ├── transaction.schema.ts
│   │   │   ├── user.schema.ts
│   │   ├── system/
│   │   │   └── init.ts
│   │   └── types/
│   │       ├── config.type.ts
│   │       ├── auth.type.ts
│   │       ├── jwt.type.ts
│   │       └── role.type.ts
│   │       ├── game.type.ts
│   │       ├── user.type.ts
│   │       ├── payout.type.ts
│   │       └── transaction.type.ts

│   └── api/
|   |   └── index.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── error.middleware.ts
│   │   │   └── permission.middleware.ts
|   │   └── modules/
|   │   |   ├── auth/
|   │   |   │   ├── auth.controller.ts
|   │   |   │   ├── auth.route.ts
|   │   |   │   ├── auth.service.ts
|   │   |   │   └── auth.types.ts
|   │   |   ├── games/
|   │   |   │   ├── games.controller.ts
|   │   |   │   ├── games.route.ts
|   │   |   │   ├── games.service.ts
|   │   |   ├── payouts/
|   │   |   │   ├── payouts.controller.ts
|   │   |   │   ├── payouts.route.ts
|   │   |   │   ├── payouts.service.ts
|   │   |   ├── roles/
|   │   |   ├── sessions/
|   │   |   ├── transactions/
|   │   |   └── users/
│   └── realtime/
|   |   └── index.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── error.middleware.ts
|   │   └── gateways/
|   │   |   ├── controls/
|   │   |   │   ├── controls.gateway.ts
|   │   |   │   ├── controls.service.ts
|   │   |   │   ├── controls.events.ts
|   │   |   │   ├── controls.types.ts
|   │   |   ├── playground/
|   │   |   │   ├── playground.gateway.ts
|   │   |   │   ├── playground.service.ts
|   │   |   │   ├── playground.events.ts
|   │   |   │   ├── playground.types.ts
|   │   └── games/
│   │   │   ├── game.engine.ts
│   │   │   ├── game.manager.ts
│   │   │   ├── game.type.ts
|   │   |   ├── slots/
|   │   |   │   ├── base.slots.engine.ts
|   │   |   │   ├── base.slots.type.ts
|   │   |   │   ├── variants/
|   │   |   │   |   ├── sl-pm/
|   │   |   │   |   │   ├── pm.slots.engine.ts
|   │   |   │   |   │   ├── pm.slots.config.ts
|   │   |   ├── keno/
|   │   |   │   ├── base.keno.engine.ts
|   │   |   │   ├── base.keno.type.ts
|   │   |   │   ├── variants/








### Usage

Once the server is running, you can access it at `http://localhost:3000`. Adjust the port in `src/server.ts` if needed.

## Contributing

Feel free to submit issues or pull requests for improvements or bug fixes.

## License

This project is licensed under the MIT License.


```
