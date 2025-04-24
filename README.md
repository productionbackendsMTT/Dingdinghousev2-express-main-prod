
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
│   │   ├── lib/
│   │   │   ├── default-permissions.ts
│   │   │   ├── default-role-hierarchy.ts
│   │   │   ├── resources.ts
│   │   │   ├── response.ts
│   │   │   └── utils.ts
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── error.middleware.ts
│   │   │   └── permission.middleware.ts
│   │   ├── system/
│   │   │   └── init.ts
│   │   └── types/
│   │       ├── app-config.ts
│   │       ├── auth.ts
│   │       ├── jwt-config.ts
│   │       └── roles.ts
│   └── api/
|   |   └── index.ts
|   │   └── modules/
|   │   |   ├── auth/
|   │   |   │   ├── auth.controller.ts
|   │   |   │   ├── auth.route.ts
|   │   |   │   ├── auth.service.ts
|   │   |   │   └── auth.types.ts
|   │   |   ├── games/
|   │   |   │   ├── games.controller.ts
|   │   |   │   ├── games.model.ts
|   │   |   │   ├── games.route.ts
|   │   |   │   ├── games.service.ts
|   │   |   │   └── games.types.ts
|   │   |   ├── payouts/
|   │   |   │   ├── payouts.controller.ts
|   │   |   │   ├── payouts.model.ts
|   │   |   │   ├── payouts.route.ts
|   │   |   │   ├── payouts.service.ts
|   │   |   │   └── payouts.types.ts
|   │   |   ├── roles/
|   │   |   ├── sessions/
|   │   |   ├── transactions/
|   │   |   └── users/
│   └── socket/
|   |   └── index.ts
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








### Usage

Once the server is running, you can access it at `http://localhost:3000`. Adjust the port in `src/server.ts` if needed.

## Contributing

Feel free to submit issues or pull requests for improvements or bug fixes. 

## License

This project is licensed under the MIT License.


