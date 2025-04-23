
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
|   |   └── index.ts
│   └── socket/

